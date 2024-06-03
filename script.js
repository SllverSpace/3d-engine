
utils.setup()
utils.setStyles()
utils.setGlobals()

webgl.setup()
webgl.setStyles()

var delta = 0
var lastTime = 0
var su = 0

var texture = new webgl.Texture("texture.png")
var alphaTexture = new webgl.Texture("alpha.png")

var camera = {pos: {x: 0, y: 0, z: 0}, rot: {x: 0, y: -Math.PI/2, z: 0}}
var speed = 2

var testr = new webgl.Box(-2, 0, -2, 1, 1, 1, [1, 0, 0])
testr.alpha = 1
testr.oneSide = false

testr.alphaTexture = alphaTexture
testr.useAlpha = true
testr.setUvs()

var testg = new webgl.Box(0, 0, -2, 1, 1, 1, [0, 1, 0])
testg.alpha = 0.5
testg.oneSide = false

var testb = new webgl.Box(2, 0, -2, 1, 1, 1, [0.5, 0.5, 1])
testb.alpha = 1
testb.oneSide = false

testb.texture = texture
testb.useTexture = true
testb.alphaTexture = alphaTexture
testb.useAlpha = true

testb.setUvs()

var floor = new webgl.Box(0, -2, 0, 10, 0.1, 10, [1, 1, 1])

floor.texture = texture
floor.useTexture = true
floor.setUvs(0, 0, 1, 1)

var time = 0

function update(timestamp) {
    requestAnimationFrame(update)

    utils.getDelta(timestamp)
    ui.resizeCanvas()
    ui.getSu()
    input.setGlobals()
    webgl.resizeCanvas()

    time += delta

    // ui.rect(canvas.width/2, canvas.height/2, 100*su, 100*su, [255, 0, 0, 1])

    if (keys["KeyW"]) {
        camera.pos.z -= speed*delta*Math.cos(camera.rot.y)
        camera.pos.x -= speed*delta*Math.sin(camera.rot.y)
    }
    if (keys["KeyS"]) {
        camera.pos.z += speed*delta*Math.cos(camera.rot.y)
        camera.pos.x += speed*delta*Math.sin(camera.rot.y)
    }
    if (keys["KeyA"]) {
        camera.pos.z += speed*delta*Math.sin(camera.rot.y)
        camera.pos.x -= speed*delta*Math.cos(camera.rot.y)
    }
    if (keys["KeyD"]) {
        camera.pos.z -= speed*delta*Math.sin(camera.rot.y)
        camera.pos.x += speed*delta*Math.cos(camera.rot.y)
    }
    if (keys["Space"]) {
        camera.pos.y += speed*delta
    }
    if (keys["ShiftLeft"]) {
        camera.pos.y -= speed*delta
    }

    if (mouse.lclick) {
        input.lockMouse()
    }

    // testr.alpha = Math.sin(time)/2+0.5

    testg.pos.z = -2+Math.sin(time+5829483)/2

    testb.pos.x = 2+Math.sin(time+958293)/2
    testb.pos.y = 0+Math.sin(time+676745)/2
    testb.pos.z = -2+Math.cos(time+958293)/2

    webgl.setView(camera)
    // webgl.setupFrame([0.5, 0.8, 0.9, 1])
    webgl.setupFrame([0, 0, 0, 1])
    webgl.render()

}

var sensitivity = 0.002

input.mouseMove = (event) => {
    this.mouse.x = event.clientX/ui.scale
    this.mouse.y = event.clientY/ui.scale

    if (input.isMouseLocked()) {
        camera.rot.x -= event.movementY*sensitivity
		if (camera.rot.x > Math.PI/2*0.99) {
			camera.rot.x = Math.PI/2*0.99
		}
		if (camera.rot.x < -Math.PI/2*0.99) {
			camera.rot.x = -Math.PI/2*0.99
		}

        camera.rot.y -= event.movementX * sensitivity
    }
}

requestAnimationFrame(update)