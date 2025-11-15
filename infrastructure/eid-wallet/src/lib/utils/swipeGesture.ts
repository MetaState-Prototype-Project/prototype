// utils/swipedetect.ts
export const swipedetect = (
    el: HTMLElement,
    callback: (dir: string) => void,
) => {
    let startX = 0;
    let startY = 0;
    let distX = 0;
    let distY = 0;

    const threshold = 100; // min distance for swipe
    const restraint = 100; // max perpendicular distance
    const allowedTime = 400; // ms

    let startTime = 0;

    el.addEventListener(
        "touchstart",
        (e: TouchEvent) => {
            const touchobj = e.changedTouches[0];
            startX = touchobj.pageX;
            startY = touchobj.pageY;
            startTime = new Date().getTime();
        },
        false,
    );

    el.addEventListener(
        "touchend",
        (e: TouchEvent) => {
            const touchobj = e.changedTouches[0];
            distX = touchobj.pageX - startX;
            distY = touchobj.pageY - startY;
            const elapsedTime = new Date().getTime() - startTime;

            if (
                elapsedTime <= allowedTime &&
                Math.abs(distX) >= threshold &&
                Math.abs(distY) <= restraint
            ) {
                const dir = distX < 0 ? "right" : "left";
                callback(dir);
            }
        },
        false,
    );
};
