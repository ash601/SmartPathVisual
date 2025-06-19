import { IconButton } from "@mui/material"; // Only IconButton is used from MUI
import { PlayArrow, Pause } from "@mui/icons-material";
import { forwardRef, useEffect, useCallback } from "react"; // Removed useState and useImperativeHandle

const Interface = forwardRef((props, ref) => { // ref is kept in signature but not used internally now
    const {
        canStart,
        started,
        animationEnded,
        playbackOn,
        startPathfinding,
        toggleAnimation,
    } = props;

    const handlePlayPause = useCallback(() => {
        if (!canStart) return;
        if (!started && !animationEnded) {
            startPathfinding();
        } else {
            toggleAnimation();
        }
    }, [canStart, started, animationEnded, startPathfinding, toggleAnimation]);

    useEffect(() => {
        const handleKeyUp = (e) => {
            if (e.code === "Space") {
                e.preventDefault();
                handlePlayPause();
            }
        };
        window.addEventListener("keyup", handleKeyUp);
        return () => window.removeEventListener("keyup", handleKeyUp);
    }, [handlePlayPause]); 

    return (
        <>
            <div className="nav-top"> {/* Assuming this class is for essential layout */}
                <IconButton
                    disabled={!canStart}
                    onClick={handlePlayPause}
                    style={{ backgroundColor: "#46B780", width: 60, height: 60, color: "#fff" }}
                    size="large"
                    aria-label={(!started || (animationEnded && !playbackOn)) ? "Play" : "Pause"}
                >
                    {(!started || (animationEnded && !playbackOn))
                        ? <PlayArrow style={{ width: 26, height: 26 }} fontSize="inherit" />
                        : <Pause style={{ width: 26, height: 26 }} fontSize="inherit" />
                    }
                </IconButton>
            </div>
        </>
    );
});

Interface.displayName = "Interface"; // Good for debugging

export default Interface;