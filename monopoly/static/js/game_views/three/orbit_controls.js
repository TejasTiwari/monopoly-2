"use strict";

/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author Zhongyi Tong / http://github.com/geeeeeeeeek
 */

THREE.OrbitControls = function (object, domElement) {
    this.object = object;
    this.domElement = (domElement !== undefined) ? domElement : document;

    // API

    this.enabled = true;

    this.center = new THREE.Vector3();

    this.userZoom = true;
    this.userZoomSpeed = 1.0;

    this.userRotate = true;
    this.userRotateSpeed = 1.0;

    this.userPan = true;
    this.userPanSpeed = 2.0;

    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.keys = {LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40};

    // internals

    let scope = this;

    let EPS = 0.000001;
    let PIXELS_PER_ROUND = 1800;

    let rotateStart = new THREE.Vector2();
    let rotateEnd = new THREE.Vector2();
    let rotateDelta = new THREE.Vector2();

    let zoomStart = new THREE.Vector2();
    let zoomEnd = new THREE.Vector2();
    let zoomDelta = new THREE.Vector2();

    let phiDelta = 0;
    let thetaDelta = 0;
    let scale = 1;

    let lastPosition = new THREE.Vector3();

    let STATE = {NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2};
    let state = STATE.NONE;

    // events

    let changeEvent = {type: 'change'};

    this.rotateLeft = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        thetaDelta -= angle;
    };

    this.rotateRight = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        thetaDelta += angle;
    };

    this.rotateUp = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        phiDelta -= angle;
    };

    this.rotateDown = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        phiDelta += angle;
    };

    this.zoomIn = zoomScale => {
        if (zoomScale === undefined) {
            zoomScale = getZoomScale();
        }
        scale /= zoomScale;
    };

    this.zoomOut = zoomScale => {
        if (zoomScale === undefined) {
            zoomScale = getZoomScale();
        }
        scale *= zoomScale;
    };

    this.pan = distance => {
        distance.transformDirection(this.object.matrix);
        distance.multiplyScalar(scope.userPanSpeed);

        this.object.position.add(distance);
        this.center.add(distance);
    };

    this.update = () => {
        let position = this.object.position;
        let offset = position.clone().sub(this.center);

        // angle from z-axis around y-axis
        let theta = Math.atan2(offset.x, offset.z);

        // angle from y-axis
        let phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z), offset.y);

        if (this.autoRotate) {
            this.rotateLeft(getAutoRotationAngle());
        }

        theta += thetaDelta;
        phi += phiDelta;

        // restrict phi to be between desired limits
        phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

        // restrict phi to be betwee EPS and PI-EPS
        phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

        let radius = offset.length() * scale;

        // restrict radius to be between desired limits
        radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        position.copy(this.center).add(offset);

        this.object.lookAt(this.center);

        thetaDelta = 0;
        phiDelta = 0;
        scale = 1;

        if (lastPosition.distanceTo(this.object.position) > 0) {
            this.dispatchEvent(changeEvent);
            lastPosition.copy(this.object.position);
        }
    };


    const getAutoRotationAngle = () => {
        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
    };

    const getZoomScale = () => {
        return Math.pow(0.95, scope.userZoomSpeed);
    };

    const onMouseDown = event => {
        if (scope.enabled === false) return;
        if (scope.userRotate === false) return;

        event.preventDefault();

        if (event.button === 0) {
            state = STATE.ROTATE;
            rotateStart.set(event.clientX, event.clientY);
        } else if (event.button === 1) {
            state = STATE.ZOOM;
            zoomStart.set(event.clientX, event.clientY);
        } else if (event.button === 2) {
            state = STATE.PAN;
        }

        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
    };

    const onMouseMove = event => {
        if (scope.enabled === false) return;

        event.preventDefault();

        if (state === STATE.ROTATE) {
            rotateEnd.set(event.clientX, event.clientY);
            rotateDelta.subVectors(rotateEnd, rotateStart);

            scope.rotateLeft(2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed);
            scope.rotateUp(2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed);

            rotateStart.copy(rotateEnd);
        } else if (state === STATE.ZOOM) {
            zoomEnd.set(event.clientX, event.clientY);
            zoomDelta.subVectors(zoomEnd, zoomStart);

            if (zoomDelta.y > 0) {
                scope.zoomIn();
            } else {
                scope.zoomOut();
            }

            zoomStart.copy(zoomEnd);
        } else if (state === STATE.PAN) {
            let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            scope.pan(new THREE.Vector3(-movementX, movementY, 0));
        }
    };

    const onMouseUp = event => {
        if (scope.enabled === false) return;
        if (scope.userRotate === false) return;

        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);

        state = STATE.NONE;
    };

    const onMouseWheel = event => {
        if (scope.enabled === false) return;
        if (scope.userZoom === false) return;

        let delta = 0;

        if (event.wheelDelta) { // WebKit / Opera / Explorer 9
            delta = event.wheelDelta;
        } else if (event.detail) { // Firefox
            delta = -event.detail;
        }

        if (delta > 0) {
            scope.zoomOut();
        } else {
            scope.zoomIn();
        }
    };

    const onKeyDown = event => {
        if (scope.enabled === false) return;
        if (scope.userPan === false) return;

        switch (event.keyCode) {
            case scope.keys.UP:
                scope.pan(new THREE.Vector3(0, 1, 0));
                break;
            case scope.keys.BOTTOM:
                scope.pan(new THREE.Vector3(0, -1, 0));
                break;
            case scope.keys.LEFT:
                scope.pan(new THREE.Vector3(-1, 0, 0));
                break;
            case scope.keys.RIGHT:
                scope.pan(new THREE.Vector3(1, 0, 0));
                break;
        }
    };

    this.domElement.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    }, false);
    this.domElement.addEventListener('mousedown', onMouseDown, false);
    this.domElement.addEventListener('mousewheel', onMouseWheel, false);
    this.domElement.addEventListener('DOMMouseScroll', onMouseWheel, false); // firefox
    this.domElement.addEventListener('keydown', onKeyDown, false);

};

THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
