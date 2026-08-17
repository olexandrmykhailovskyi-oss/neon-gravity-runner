/**
 * Collision.js — геометричні колізії.
 * Оптимізовано для виклику в кожному кадрі.
 * circle: {x, y, radius | r}
 * rect:   {x, y, w | width, h | height}
 */
(function () {
    'use strict';

    function circleRectDist(cx, cy, cr, rx, ry, rw, rh) {
        const closestX = (cx < rx) ? rx : (cx > rx + rw ? rx + rw : cx);
        const closestY = (cy < ry) ? ry : (cy > ry + rh ? ry + rh : cy);
        const dx = cx - closestX;
        const dy = cy - closestY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function circleRect(circle, rect) {
        if (!circle || !rect) return false;
        const cx = circle.x;
        const cy = circle.y;
        const cr = circle.radius != null ? circle.radius : (circle.r != null ? circle.r : 0);
        const rx = rect.x;
        const ry = rect.y;
        const rw = rect.w != null ? rect.w : (rect.width != null ? rect.width : 0);
        const rh = rect.h != null ? rect.h : (rect.height != null ? rect.height : 0);

        if (cr < 0 || rw < 0 || rh < 0) return false;

        const closestX = (cx < rx) ? rx : (cx > rx + rw ? rx + rw : cx);
        const closestY = (cy < ry) ? ry : (cy > ry + rh ? ry + rh : cy);
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) <= (cr * cr);
    }

    function circles(c1, c2) {
        if (!c1 || !c2) return false;
        const r1 = c1.radius != null ? c1.radius : (c1.r != null ? c1.r : 0);
        const r2 = c2.radius != null ? c2.radius : (c2.r != null ? c2.r : 0);
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const rr = r1 + r2;
        return (dx * dx + dy * dy) <= (rr * rr);
    }

    function circleCircleDist(c1, c2) {
        if (!c1 || !c2) return Infinity;
        const r1 = c1.radius != null ? c1.radius : (c1.r != null ? c1.r : 0);
        const r2 = c2.radius != null ? c2.radius : (c2.r != null ? c2.r : 0);
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        return Math.max(0, d - (r1 + r2));
    }

    window.Collision = {
        circleRect: circleRect,
        circleRectDist: circleRectDist,
        circles: circles,
        circleCircleDist: circleCircleDist
    };
})();
