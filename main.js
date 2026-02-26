// main.js

// This script handles gravity simulation logic and UI integration for the planetary simulator.

// Constants
const GRAVITY_CONSTANT = 9.81; // m/s^2

// Class to represent a planet
class Planet {
    constructor(name, mass, radius) {
        this.name = name;
        this.mass = mass;
        this.radius = radius;
    }

    // Calculate the gravitational force on an object
    gravityForce(objectMass) {
        return (GRAVITY_CONSTANT * this.mass * objectMass) / (this.radius * this.radius);
    }
}

// Class to handle simulation of multiple planets
class PlanetSimulator {
    constructor() {
        this.planets = [];
    }

    addPlanet(planet) {
        this.planets.push(planet);
    }

    simulateGravity(objectMass) {
        return this.planets.map(planet => {
            return {
                planet: planet.name,
                force: planet.gravityForce(objectMass)
            };
        });
    }
}

// UI Integration
const simulator = new PlanetSimulator();

// Example planets
const earth = new Planet('Earth', 5.972e24, 6371000);
const moon = new Planet('Moon', 7.34767309e22, 1737100);

simulator.addPlanet(earth);
simulator.addPlanet(moon);

// Input mass of the object
const objectMass = 10; // kg
const gravityResults = simulator.simulateGravity(objectMass);

// Display results in the console
console.log('Gravitational Forces on Object:');
gravityResults.forEach(result => {
    console.log(`Planet: ${result.planet}, Gravitational Force: ${result.force.toFixed(2)} N`);
});