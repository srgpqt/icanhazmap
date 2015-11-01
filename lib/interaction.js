
module.exports = Interaction;
function Interaction(element, control) {
	var enabled = false;
	var lastMouseX, lastMouseY;
	var lastTouch0, lastTouch1;

	this.enable = enable;
	function enable() {
		if (enabled) {
			disable();
		}

		enabled = true;

		element.addEventListener('wheel', onWheel);
		element.addEventListener('dragstart', onDragStart);
		element.addEventListener('mousedown', onMouseDown);
		element.addEventListener('mousemove', onMouseMove);
		element.addEventListener('mouseup', onMouseUp);
		element.addEventListener('touchstart', onTouchStart);
		element.addEventListener('touchmove', onTouchMove);
		element.addEventListener('touchend', onTouchEnd);
	}

	this.disable = disable;
	function disable() {
		element.removeEventListener('wheel', onWheel);
		element.removeEventListener('dragstart', onDragStart);
		element.removeEventListener('mousedown', onMouseDown);
		element.removeEventListener('mousemove', onMouseMove);
		element.removeEventListener('mouseup', onMouseUp);
		element.removeEventListener('touchstart', onTouchStart);
		element.removeEventListener('touchmove', onTouchMove);
		element.removeEventListener('touchend', onTouchEnd);

		enabled = false;
	}

	this.isEnabled = isEnabled;
	function isEnabled() {
		return enabled;
	}

	this.destroy = destroy;
	function destroy() {
		disable();
		element = control = null;
	}

	function onWheel(event) {
		event.preventDefault();
		// control.zoomAtXY(Math.max(-2.0, Math.min(2.0, event.deltaY)) * -0.1, [
		control.zoomAtXY(Math.log(Math.abs(event.deltaY) + 1) * Math.sign(event.deltaY) * -0.1, [
			event.clientX,
			event.clientY
		]);
	}

	function onDragStart(event) {
		event.preventDefault();
	}

	function onMouseDown(event) {
		event.preventDefault();
		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
	}

	function onMouseMove(event) {
		event.preventDefault();

		if (event.buttons === 0 || event.which === 0) {
			lastMouseX = null;
			return;
		}

		if (lastMouseX != null) {
			if (event.buttons === 1 || event.which === 1) {
				control.panByXY([
					event.clientX - lastMouseX,
					event.clientY - lastMouseY
				]);
			}
		}

		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
	}

	function onMouseUp(event) {
		event.preventDefault();
		lastMouseX = null;
	}

	function onTouchStart(event) {
		event.preventDefault();
		lastTouch0 = event.touches[0] && [ event.touches[0].clientX, event.touches[0].clientY ];
		lastTouch1 = event.touches[1] && [ event.touches[1].clientX, event.touches[1].clientY ];
	}

	function onTouchMove(event) {
		event.preventDefault();

		var touch0 = event.touches[0];
		var touch1 = event.touches[1];

		var currentTouch0 = touch0 && [ touch0.clientX, touch0.clientY ];
		var currentTouch1 = touch1 && [ touch1.clientX, touch1.clientY ];

		if (currentTouch0 && lastTouch0) {
			control.manipulate(
				currentTouch0, lastTouch0,
				currentTouch1, lastTouch1
			);
		}

		lastTouch0 = currentTouch0;
		lastTouch1 = currentTouch1;
	}

	function onTouchEnd(event) {
		event.preventDefault();
		lastTouch0 = lastTouch1 = null;
	}
}
