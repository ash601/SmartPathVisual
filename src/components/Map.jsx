import DeckGL from "@deck.gl/react"; // This is for the fancy 3D map layers, from Deck.gl
import { Map as MapGL } from "react-map-gl"; // And this is for the basic map tile display, using react-map-gl
import maplibregl from "maplibre-gl"; // The actual map rendering engine, open source one
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers"; // Deck.gl layers for drawing shapes (polygons) and dots (scatterplot)
import { TripsLayer } from "@deck.gl/geo-layers"; // A special Deck.gl layer for animating paths, like trips
import { createGeoJSONCircle } from "../helpers"; // Our little helper to make data for a circle
import { useEffect, useRef, useState } from "react"; // Standard React stuff for state, refs, and doing things after render
import { getBoundingBoxFromPolygon, getMapGraph, getNearestNode } from "../services/MapService"; // Our own service for mapy logic
import PathfindingState from "../models/PathfindingState"; // This guy manages the whole pathfinding algorithm's state
import Interface from "./Interface"; // The UI component with buttons, etc.
import { INITIAL_COLORS, INITIAL_VIEW_STATE, MAP_STYLE } from "../config"; // App settings like colors, where map starts, and map style URL


const FIXED_RADIUS = 4;
const FIXED_SPEED = 5;
const FIXED_ALGORITHM = "dijkstra";

function Map() {
        // these hold data that can change, and when they change, React redraws things

        const [startNode, setStartNode] = useState(null); // for the starting point of the path, nothing at first
        const [endNode, setEndNode] = useState(null);     // for the ending point, also nothing to start
        const [selectionRadius, setSelectionRadius] = useState([]); // data for that green circle area, starts empty
        const [tripsData, setTripsData] = useState([]);     // data for the lines that get animated, empty initially
        const [started, setStarted] = useState(false);       // is the pathfinding animation actually running? default no
        const [time, setTime] = useState(0);               // keeps track of the animation's current time, for the TripsLayer
        const [animationEnded, setAnimationEnded] = useState(false); // has the whole animation finished? default no
        const [playbackOn, setPlaybackOn] = useState(false);   // is it currently playing (not paused)? default no
        const [placeEnd, setPlaceEnd] = useState(false);       // a flag, for when we're in 'place the end node' mode (useful for mobile)
        const [loading, setLoading] = useState(false);         // true if we're fetching data or something slow, for the loading spinner
    
        // settings for the pathfinding, using those FIXED_ values from above
        const [settings, setSettings] = useState({
            algorithm: FIXED_ALGORITHM,
            radius: FIXED_RADIUS,
            speed: FIXED_SPEED
        });
        
        // colors for different map things, loaded from our config file
        const [colors, setColors] = useState(INITIAL_COLORS);
        
        // the map's current camera view (like where it's looking and zoom level), starts at Dehradun (from config)
        const [viewState, setViewState] = useState(INITIAL_VIEW_STATE); 
        
        // --- React Refs ('useRef') ---
        // these are for holding onto things (like a direct link to a component, or a value that can change *without* making React redraw)
    
        const ui = useRef(); // this will hold a reference to our Interface component, so we can call its functions (like showSnack)
    
        const requestRef = useRef();        // stores the ID from requestAnimationFrame, so we can cancel it if needed
        const previousTimeRef = useRef();   // remembers the timestamp of the last animation frame, to help make animation smooth
        const timer = useRef(0);            // a mutable value, probably used to help create timestamps for drawing path segments
        const waypoints = useRef([]);       // a mutable list, kinda like a temporary spot to gather path waypoints before updating the tripsData state
        const state = useRef(new PathfindingState()); // VERY important! This holds the instance of our main pathfinding logic manager
        const traceNode = useRef(null);     // helps keep track of the current node when we're drawing the final path by going backwards from the end

        // --- Functions ---
    
        // this gets called when the user clicks on the map    
    async function mapClick(e, info) {
        if(started && !animationEnded) return;

        clearPath();

        if(info.rightButton || placeEnd) {
            if(e.layer?.id !== "selection-radius") {
                ui.current.showSnack("Please select a point inside the radius.", "info");
                return;
            }
            
            if(loading) {
                ui.current.showSnack("Please wait for all data to load.", "info");
                return;
            }
            const loadingHandle = setTimeout(() => setLoading(true), 300);
            const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
            clearTimeout(loadingHandle);
            setLoading(false);
            if(!node) {
                ui.current.showSnack("No path was found in the vicinity, please try another location.");
                return;
            }
            const realEndNode = state.current.getNode(node.id);
            setEndNode(node);
            
            if(!realEndNode) {
                ui.current.showSnack("An error occurred. Please try again.");
                return;
            }

            state.current.endNode = realEndNode;
            return;
        }

        const loadingHandle = setTimeout(() => setLoading(true), 300);
        const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
        clearTimeout(loadingHandle);
        setLoading(false);

        if(!node) {
            ui.current.showSnack("No path was found in the vicinity, please try another location.");
            return;
        }

        setStartNode(node);
        setEndNode(null);
        const circle = createGeoJSONCircle([node.lon, node.lat], settings.radius);
        setSelectionRadius([{ contour: circle}]);
        
        const graphLoadingHandle = setTimeout(() => setLoading(true), 300);
        getMapGraph(getBoundingBoxFromPolygon(circle), node.id).then(graph => {
            state.current.graph = graph;
            clearPath(); // Clears path again after graph is loaded for the new start node
        }).catch(error => {
            console.error("Error fetching map graph:", error);
            ui.current.showSnack("Error fetching map data. Please try again.", "error");
        }).finally(() => {
            clearTimeout(graphLoadingHandle);
            setLoading(false);
        });
    }

    function startPathfinding() {
        if (!startNode || !endNode) {
            ui.current.showSnack("Please select a start and end node.", "info");
            return;
        }

        setTimeout(() => {
            clearPath();
            state.current.start(settings.algorithm); // Uses fixed algorithm
            setAnimationEnded(false);
            setStarted(true);
            setPlaybackOn(true);
        }, 400); 
    }

    function toggleAnimation(loop = true) {
        if (!startNode || !endNode) return;

        if (animationEnded) {
            if (loop) {
                setTime(0);
                setAnimationEnded(false);
                setStarted(true);
                setPlaybackOn(true);
            }
            return;
        }
        setStarted(!started);
        setPlaybackOn(!playbackOn);

        if (!started) {
            previousTimeRef.current = null;
        }
    }

    function clearPath() {
        setStarted(false);
        setPlaybackOn(false);
        setTripsData([]);
        setTime(0);
        if (state.current.graph) {
            state.current.reset();
        }
        waypoints.current = [];
        timer.current = 0;
        previousTimeRef.current = null;
        traceNode.current = null;
        setAnimationEnded(false);
    }

    function animateStep(newTime) {
        const updatedNodes = state.current.nextStep();
        for(const updatedNode of updatedNodes) {
            updateWaypoints(updatedNode, updatedNode.referer);
        }

        if(state.current.finished && !animationEnded) {
            if(!traceNode.current) traceNode.current = state.current.endNode;
            const parentNode = traceNode.current?.parent;
            updateWaypoints(parentNode, traceNode.current, "route", Math.max(Math.log2(settings.speed), 1));
            traceNode.current = parentNode ?? traceNode.current;

            if (time >= timer.current && parentNode == null) {
                setAnimationEnded(true);
                setStarted(false);
                setPlaybackOn(false);
            }
        }

        if (previousTimeRef.current != null && !animationEnded && started) {
            const deltaTime = newTime - previousTimeRef.current;
            setTime(prevTime => (prevTime + deltaTime));
        }
    }

    function animate(newTime) {
        if (!started) return;

        for(let i = 0; i < settings.speed; i++) {
            if (animationEnded) break;
            animateStep(newTime);
        }

        previousTimeRef.current = newTime;
        if (!animationEnded) {
             requestRef.current = requestAnimationFrame(animate);
        }
    }

    function updateWaypoints(node, refererNode, color = "path", timeMultiplier = 1) {
        if(!node || !refererNode) return;
        const distance = Math.hypot(node.longitude - refererNode.longitude, node.latitude - refererNode.latitude);
        const timeAdd = distance * 50000 * timeMultiplier;

        waypoints.current = [...waypoints.current,
            {
                path: [[refererNode.longitude, refererNode.latitude], [node.longitude, node.latitude]],
                timestamps: [timer.current, timer.current + timeAdd],
                color,
            }
        ];
        timer.current += timeAdd;
        setTripsData([...waypoints.current]);
    }


    useEffect(() => {
        if (started && !animationEnded) {
            requestRef.current = requestAnimationFrame(animate);
        } else if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [started, animationEnded]);

    return (
        <>
            <div onContextMenu={(e) => { e.preventDefault(); }}>
                <DeckGL
                    initialViewState={viewState} 
                    controller={{ doubleClickZoom: false, keyboard: false }}
                    onClick={mapClick}
                >
                                        {/* Layer 1: The Green Selection Radius */}

                    <PolygonLayer
                        id={"selection-radius"}
                        data={selectionRadius}
                        pickable={true}
                        stroked={true}
                        getPolygon={d => d.contour}
                        getFillColor={[80, 210, 0, 10]}
                        getLineColor={[9, 142, 46, 175]}
                        getLineWidth={3}
                        opacity={1} // CHANGED from selectionRadiusOpacity
                    />

                                        {/* Layer 2: The Animated Pathfinding Lines */}

                    <TripsLayer
                        id={"pathfinding-layer"}
                        data={tripsData}
                        opacity={1}
                        widthMinPixels={3}
                        widthMaxPixels={5}
                        fadeTrail={false}
                        currentTime={time}
                        getColor={d => colors[d.color]} // Uses INITIAL_COLORS
                        updateTriggers={{
                            getColor: [colors.path, colors.route]
                        }}
                    />
                                        {/* Layer 3: The Start and End Point Markers */}
                    <ScatterplotLayer
                        id="start-end-points"
                        data={[
                            ...(startNode ? [{ coordinates: [startNode.lon, startNode.lat], color: colors.startNodeFill, lineColor: colors.startNodeBorder }] : []),
                            ...(endNode ? [{ coordinates: [endNode.lon, endNode.lat], color: colors.endNodeFill, lineColor: colors.endNodeBorder }] : []),
                        ]}
                        pickable={true}
                        opacity={1}
                        stroked={true}
                        filled={true}
                        radiusScale={1}
                        radiusMinPixels={7}
                        radiusMaxPixels={20}
                        lineWidthMinPixels={1}
                        lineWidthMaxPixels={3}
                        getPosition={d => d.coordinates}
                        getFillColor={d => d.color}
                        getLineColor={d => d.lineColor}
                    />

                                        {/* The Base Map Tiles this is basic map */}
                    <MapGL
                        reuseMaps mapLib={maplibregl}
                        mapStyle={MAP_STYLE}
                        doubleClickZoom={false}
                    />
                </DeckGL>
            </div>
                        {/* The User Interface Controls */}

            <Interface
                ref={ui}
                canStart={startNode && endNode}
                started={started}
                animationEnded={animationEnded}
                playbackOn={playbackOn}
                loading={loading}
                placeEnd={placeEnd}
                setPlaceEnd={setPlaceEnd}
                startPathfinding={startPathfinding}
                toggleAnimation={toggleAnimation}
            />
            <div className="attrib-container"><summary className="maplibregl-ctrl-attrib-button" title="Toggle attribution" aria-label="Toggle attribution"></summary><div className="maplibregl-ctrl-attrib-inner">© <a href="https://carto.com/about-carto/" target="_blank" rel="noopener">CARTO</a>, © <a href="http://www.openstreetmap.org/about/" target="_blank">OpenStreetMap</a> contributors</div></div>
        </>
    );
}

export default Map;