import * as THREE from "three";
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';

let waiting_for_confirmation = false;

export function checkControllerAction(controllers, data, session, waiting = waiting_for_confirmation) {

    Object.values(controllers).forEach((controller) => {
        if (controller?.gamepad) {
            controller.gamepad.update();
        }
    });

    if (controllers.hasOwnProperty("right") && controllers.right !== null) {

        const {gamepad, raySpace} = controllers.right;

        if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
            console.log("Trigger on right controller was activated:", XR_BUTTONS.TRIGGER, gamepad);

            const controller_vector = new THREE.Group();

            raySpace.getWorldPosition(controller_vector.position);
            raySpace.getWorldQuaternion(controller_vector.quaternion);

            if (!!waiting) {
                console.log("Cancel action");
                waiting_for_confirmation = false;
            }

            data.action = `Trigger on right controller was activated: ${XR_BUTTONS.TRIGGER}`;
            data.controller_vector = controller_vector;
            data.waiting_for_confirmation = waiting_for_confirmation;

        } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_1)) {
            console.log("BUTTON_1 (A) on right controller was activated:", XR_BUTTONS.BUTTON_1, gamepad);
            if (!!waiting) {
                console.log("Confirm action");
                waiting_for_confirmation = false;

                console.log("End session");

                data.action = "End session confirmed";
                data.waiting_for_confirmation = waiting_for_confirmation;
                session.end();
            }

        } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_2)) {
            console.log("BUTTON_2 (B) on right controller was activated:", XR_BUTTONS.BUTTON_2, gamepad);

            if (!!waiting) {
                console.log("Cancel action");
                waiting_for_confirmation = false;
                data.action = "End session cancelled";
            } else {
                console.log("Waiting for confirmation...")
                waiting_for_confirmation = true;
                data.action = "End session initiated";
            }

            data.waiting_for_confirmation = waiting_for_confirmation;

        } else {
            for (const b in XR_BUTTONS) {
                if (XR_BUTTONS.hasOwnProperty(b)) {
                    // console.log("Check button: ", XR_BUTTONS[b]);
                    if (gamepad.getButtonClick(XR_BUTTONS[b])) {
                        console.log("Button on right controller was activated:", XR_BUTTONS[b], gamepad);

                        if (!!waiting) {
                            console.log("Cancel action");
                            waiting_for_confirmation = false;
                        }

                        data.waiting_for_confirmation = waiting_for_confirmation;
                    }
                }
            }
        }
    }

    if (controllers.hasOwnProperty("left") && controllers.left !== null) {

        const {gamepad, raySpace} = controllers.left;

        if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
            console.log("Trigger on left controller was activated:", XR_BUTTONS.TRIGGER, gamepad);

            const controller_vector = new THREE.Group();

            raySpace.getWorldPosition(controller_vector.position);
            raySpace.getWorldQuaternion(controller_vector.quaternion);

            if (!!waiting) {
                console.log("Cancel action");
                waiting_for_confirmation = false;
            }

            data.action = `Trigger on left controller was activated: ${XR_BUTTONS.TRIGGER}`;
            data.controller_vector = controller_vector;
            data.waiting_for_confirmation = waiting_for_confirmation;

        } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_1)) {
            console.log("BUTTON_1 (X) on left controller was activated:", XR_BUTTONS.BUTTON_1, gamepad);

            if (!!waiting) {
                console.log("Cancel action");
                waiting_for_confirmation = false;
            }

            data.waiting_for_confirmation = waiting_for_confirmation;

        } else if (gamepad.getButtonClick(XR_BUTTONS.BUTTON_2)) {
            console.log("BUTTON_2 (Y) on left controller was activated:", XR_BUTTONS.BUTTON_2, gamepad);

            if (!!waiting) {
                console.log("Cancel action");
                waiting_for_confirmation = false;
            }

            data.waiting_for_confirmation = waiting_for_confirmation;

        } else {
            for (const b in XR_BUTTONS) {
                if (XR_BUTTONS.hasOwnProperty(b)) {
                    // console.log("Check button: ", XR_BUTTONS[b]);
                    if (gamepad.getButtonClick(XR_BUTTONS[b])) {
                        console.log("Button on left controller was activated:", XR_BUTTONS[b], gamepad);

                        if (!!waiting) {
                            console.log("Cancel action");
                            waiting_for_confirmation = false;
                        }

                        data.waiting_for_confirmation = waiting_for_confirmation;
                    }
                }
            }
        }
    }

    return !!waiting_for_confirmation;
}
