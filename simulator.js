const G = 6.674e-11; // Gravitational constant
let planets = [];
let showForces = false;
let selectedPlanet = null;
let animationId = null;

class Planet {
    constructor(x, y, vx = 0, vy = 0, mass = 1e24, radius = 10) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
        this.radius = radius;
        this.ax = 0;
        this.ay = 0;
        this.trail = [];
        this.color = this.getRandomColor();
    }

    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateForces(planets) {
        this.ax = 0;
        this.ay = 0;

        for (let other of planets) {
            if (other === this) continue;

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            if (dist < this.radius + other.radius) return; // Collision

            const force = (G * this.mass * other.mass) / distSq;
            const ax = (force / this.mass) * (dx / dist);
            const ay = (force / this.mass) * (dy / dist);

            this.ax += ax;
            this.ay += ay;
        }
    }

    update(dt = 0.016) {
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 200) this.trail.shift();
    }

    draw(ctx) {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Draw planet
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw selection indicator
        if (selectedPlanet === this) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    drawForce(ctx) {
        if (this.ax === 0 && this.ay === 0) return;

        const scale = 0.01;
        const forceX = this.ax * scale;
        const forceY = this.ay * scale;

        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + forceX, this.y + forceY);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(forceY, forceX);
        const arrowSize = 8;
        ctx.beginPath();
        ctx.moveTo(this.x + forceX, this.y + forceY);
        ctx.lineTo(this.x + forceX - arrowSize * Math.cos(angle - Math.PI / 6), this.y + forceY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(this.x + forceX, this.y + forceY);
        ctx.lineTo(this.x + forceX - arrowSize * Math.cos(angle + Math.PI / 6), this.y + forceY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }
}

function simulate() {
    for (let planet of planets) {
        planet.updateForces(planets);
    }

    for (let planet of planets) {
        planet.update();
    }
}

function draw(canvas, ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let planet of planets) {
        planet.draw(ctx);
        if (showForces) {
            planet.drawForce(ctx);
        }
    }
}

function animate(canvas, ctx) {
    simulate();
    draw(canvas, ctx);
    animationId = requestAnimationFrame(() => animate(canvas, ctx));
}

function addPlanet(x, y, mass = 1e24, radius = 10, vx = 0, vy = 0) {
    planets.push(new Planet(x, y, vx, vy, mass, radius));
}

function editPlanet(index, mass, radius, vx, vy) {
    if (planets[index]) {
        planets[index].mass = mass;
        planets[index].radius = radius;
        planets[index].vx = vx;
        planets[index].vy = vy;
    }
}

function removePlanet(index) {
    planets.splice(index, 1);
}

function getPlanetAtPosition(x, y) {
    for (let i = planets.length - 1; i >= 0; i--) {
        const dx = planets[i].x - x;
        const dy = planets[i].y - y;
        if (dx * dx + dy * dy <= planets[i].radius * planets[i].radius) {
            return i;
        }
    }
    return -1;
}

function clearTrails() {
    for (let planet of planets) {
        planet.trail = [];
    }
}

function resetSimulation() {
    planets = [];
    selectedPlanet = null;
    clearTrails();
}

export { Planet, addPlanet, editPlanet, removePlanet, getPlanetAtPosition, animate, clearTrails, resetSimulation };