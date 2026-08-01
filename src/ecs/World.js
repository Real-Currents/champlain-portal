/**
 * Lightweight ECS coordinator inspired by IWSDK/elics patterns.
 * No external ECS dependency — used for separating data (components)
 * from logic (systems) within the existing Three.js render loop.
 */
export class World {
    constructor() {
        /** @type {Map<string, object>} */
        this.entities = new Map();
        /** @type {Map<string, Map<string, object>>} component data keyed by entityId, then by component type */
        this.components = new Map();
        /** @type {Map<string, Array<object>>} components grouped by type for fast queries */
        this.componentsByType = new Map();
        /** @type {Array<object>} */
        this.systems = [];
    }

    /**
     * Register an entity by unique id.
     * @param {string} id
     * @returns {string} the entity id
     */
    createEntity(id) {
        this.entities.set(id, { id });
        this.components.set(id, new Map());
        return id;
    }

    /**
     * Attach a component instance to an entity.
     * @param {string} entityId
     * @param {string} type
     * @param {object} data
     */
    addComponent(entityId, type, data) {
        const entityComponents = this.components.get(entityId);
        if (!entityComponents) {
            console.warn(`World: entity "${entityId}" does not exist.`);
            return;
        }
        entityComponents.set(type, data);

        if (!this.componentsByType.has(type)) {
            this.componentsByType.set(type, []);
        }
        const list = this.componentsByType.get(type);
        if (!list.includes(data)) list.push(data);
    }

    /**
     * Direct lookup of a component on an entity.
     * @param {string} entityId
     * @param {string} type
     * @returns {object | undefined}
     */
    getComponent(entityId, type) {
        return this.components.get(entityId)?.get(type);
    }

    /**
     * Query all component instances of a given type.
     * @param {string} type
     * @returns {Array<object>}
     */
    query(type) {
        return this.componentsByType.get(type) || [];
    }

    /**
     * Register a system. Systems must implement update(deltaTime, world).
     * @param {object} system
     */
    registerSystem(system) {
        this.systems.push(system);
    }

    /**
     * Run all registered systems.
     * @param {number} deltaTime — seconds since last frame
     */
    update(deltaTime) {
        this.systems.forEach(system => {
            if (typeof system.update === 'function') {
                system.update(deltaTime, this);
            }
        });
    }
}

export default World;
