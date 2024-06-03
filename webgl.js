class Webgl {
	gId = 3
	meshes = []
	cId = ""
	programCache = {}
	uniforms = {}
	attributes = {}
	uniformCache = {}
	attributeCache = {}
	uniformVCache = {}
	uniformsV = {}
	sortCooldown = 0
	lastView
	lastProjection
	updateView = true
	updateProjection = true
	rDistance = 0
	modelBuffer
	ri = 0
	rendering = 0
	sFrameBuffer
	framebuffer
	colorTex
	weightTex
	sColourTex
	sDistanceTex
	drawBuffers
	sDrawBuffers
	depthBuffer
	bg = [0, 0, 0, 1]
	tVertexShader = `#version 300 es
		precision highp float;
		uniform mat4 uModel;
		uniform mat4 uView;
		uniform mat4 uProjection;
		
		layout(location = 0) in vec4 aPosition;
		layout(location = 1) in vec2 aUv;
		layout(location = 2) in vec4 aColour; 
		
		out vec2 vUv;
		out vec4 vColour;
		out vec4 vPos;
		out mat4 vView;
		void main() {
			vUv = aUv;
			vColour = aColour;
			vPos = uModel * aPosition;
			vView = uView;
			gl_Position = uProjection * uView * uModel * aPosition;
			gl_PointSize = 5.0;
		}
	`
	tFragmentShader = `#version 300 es
		precision highp float;

		in vec2 vUv;
		in vec4 vColour;
		in vec4 vPos;
		in mat4 vView;

		uniform bool useTexture;
		uniform sampler2D uTexture;
		uniform bool useAlphaMap;
		uniform sampler2D uAlpha;
		uniform sampler2D uDistanceTex;

		uniform float uAlpha2;
		
		layout(location = 0) out vec4 fragColour;
		layout(location = 1) out vec2 revealColour;

		void main() {
			float sDistance = texture(uDistanceTex, gl_FragCoord.xy / vec2(textureSize(uDistanceTex, 0).xy)).r;

			vec4 vSpace = vView * vec4(vPos.xyz, 1.0);
			float distance = 1.0 - length(vSpace.xyz)/100.0/10.0;	

			vec2 rUv = vec2(vUv.x - round(vUv.x-0.5), vUv.y - round(vUv.y-0.5));
			
			vec4 colour = vColour;
			if (useTexture) {
				colour = texture(uTexture, rUv);
				colour.r *= vColour.r;
				colour.g *= vColour.g;
				colour.b *= vColour.b;
			}
			float alpha = uAlpha2;
			if (useAlphaMap) {
				alpha *= texture(uAlpha, rUv).r;
			}
			if (alpha <= 0.0) {
				discard;
			}

			if (distance <= sDistance) {
				discard;
				// colour.b = 1.0;
			}

            // alpha *= alpha;

			// colour.b = sDistance*1000.0*10.0;

			// colour.b = 0.0;

			colour.rgb *= alpha/10.0;

			fragColour = vec4(colour.rgb, alpha/10.0);
			revealColour = vec2(alpha, 0.01);
		}
	`
	tUniforms = {
		model: "uModel",
		view: "uView",
		projection: "uProjection",
		useTexture: "useTexture",
		texture: "uTexture",
		useAlphaMap: "useAlphaMap",
		alpha: "uAlpha",
		alpha2: "uAlpha2",
		distanceTexture: "uDistanceTex"
	}
	tAttributes = {
		vertices: "aPosition",
		uvs: "aUv",
		colours: "aColour"
	}
	cVertexShader = `#version 300 es
		precision highp float;
		
		vec2 positions[4] = vec2[4](
			vec2(-1.0, -1.0),
			vec2( 1.0, -1.0),
			vec2(-1.0,  1.0),
			vec2( 1.0,  1.0)
		);
		
		vec2 texCoords[4] = vec2[4](
			vec2(0.0, 0.0),
			vec2(1.0, 0.0),
			vec2(0.0, 1.0),
			vec2(1.0, 1.0)
		);
		
		out vec2 vTexCoord;
		
		void main() {
			gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
			vTexCoord = texCoords[gl_VertexID];
		}
	`
	cFragmentShader = `#version 300 es
		precision highp float;
		
		uniform sampler2D uAccumTexture;
		uniform sampler2D uRevealTexture;
		
		out vec4 fragColor;
		
		void main() {
			vec4 accum = texture(uAccumTexture, gl_FragCoord.xy / vec2(textureSize(uAccumTexture, 0).xy));
			vec2 reveal = texture(uRevealTexture, gl_FragCoord.xy / vec2(textureSize(uRevealTexture, 0).xy)).rg;

			float fragments = reveal.g * 100.0;
			if (fragments < 1.0) {
				fragments = 1.0;
			}

            float alpha = reveal.r/fragments;
			if (reveal.r == 0.0) alpha = 0.0;		
			fragColor = vec4(accum.rgb / max(accum.a, 0.0001), alpha);
		}
	`
	cUniforms = {
		"accumTexture": "uAccumTexture",
		"revealTexture": "uRevealTexture",
	}
	scVertexShader = `#version 300 es
		precision highp float;
		
		vec2 positions[4] = vec2[4](
			vec2(-1.0, -1.0),
			vec2( 1.0, -1.0),
			vec2(-1.0,  1.0),
			vec2( 1.0,  1.0)
		);
		
		vec2 texCoords[4] = vec2[4](
			vec2(0.0, 0.0),
			vec2(1.0, 0.0),
			vec2(0.0, 1.0),
			vec2(1.0, 1.0)
		);
		
		out vec2 vTexCoord;
		
		void main() {
			gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
			vTexCoord = texCoords[gl_VertexID];
		}
	`
	scFragmentShader = `#version 300 es
		precision highp float;
		
		uniform sampler2D uColourTexture;
		
		out vec4 fragColour;
		
		void main() {
			vec4 colour = texture(uColourTexture, gl_FragCoord.xy / vec2(textureSize(uColourTexture, 0).xy));

			fragColour = colour;
		}
	`
	scUniforms = {
		"colourTexture": "uColourTexture",
	}
	vertexShader = `#version 300 es
		uniform mat4 uModel;
		uniform mat4 uView;
		uniform mat4 uProjection;
		
		layout(location = 0) in vec4 aPosition;
		layout(location = 1) in vec2 aUv;
		layout(location = 2) in vec4 aColour; 
		
		out vec2 vUv;
		out vec4 vColour;
		out vec4 vPos;
		out mat4 vView;
		void main() {
			vUv = aUv;
			vColour = aColour;
			vPos = uModel * aPosition;
			vView = uView;
			gl_Position = uProjection * uView * uModel * aPosition;
			gl_PointSize = 5.0;
		}
	`
	fragmentShader = `#version 300 es
		precision highp float;

		in vec2 vUv;
		in vec4 vColour;
		in vec4 vPos;
		in mat4 vView;

		uniform bool useTexture;
		uniform sampler2D uTexture;

		layout(location = 0) out vec4 fragColour;
		layout(location = 1) out vec2 distanceColour;
		
		void main() {
			vec2 rUv = vec2(vUv.x - round(vUv.x-0.5), vUv.y - round(vUv.y-0.5));
			
			vec4 colour = vColour;
			if (useTexture) {
				colour = texture(uTexture, rUv);
				colour.r *= vColour.r;
				colour.g *= vColour.g;
				colour.b *= vColour.b;
			}

			vec4 vSpace = vView * vec4(vPos.xyz, 1.0);
			float distance = length(vSpace.xyz)/100.0;	

			fragColour = vec4(colour.rgb, 1.0);
			distanceColour = vec2(1.0 - distance/10.0, 0.0);
		}
	`
	dUniforms = {
		model: "uModel",
		view: "uView",
		projection: "uProjection",
		useTexture: "useTexture",
		texture: "uTexture",
	}
	dAttributes = {
		vertices: "aPosition",
		uvs: "aUv",
		colours: "aColour"
	}
	setup(id="glcanvas") {
        window.glcanvas = document.getElementById(id)
        window.gl = window.glcanvas.getContext("webgl2", {antialias: false})
        let ext = gl.getExtension('EXT_color_buffer_float')
        if (!ext) {
            console.error('Floating-point color buffer not supported')
            throw new Error('Floating-point color buffer not supported')
        }

        let mat4script = document.createElement("script")
        mat4script.type = "text/javascript"
        mat4script.src = "https://cdnjs.cloudflare.com/ajax/libs/gl-matrix/2.8.1/gl-matrix-min.js"
        document.head.appendChild(mat4script)

        window.fov = 70

        mat4script.onload = () => {
            window.view = mat4.create()
            window.projection = mat4.create()
        }

		this.sFrameBuffer = gl.createFramebuffer()
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFrameBuffer)

		this.sColourTex = gl.createTexture()
		gl.activeTexture(gl["TEXTURE" + 0])
		gl.bindTexture(gl.TEXTURE_2D, this.sColourTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

		this.sDistanceTex = gl.createTexture()
		gl.activeTexture(gl["TEXTURE" + 1])
		gl.bindTexture(gl.TEXTURE_2D, this.sDistanceTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sColourTex, 0)
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.sDistanceTex, 0)

		this.sDrawBuffers = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]
		gl.drawBuffers(this.sDrawBuffers)

		this.depthBuffer = gl.createRenderbuffer()
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, glcanvas.width, glcanvas.height)
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer)



		this.framebuffer = gl.createFramebuffer()
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)

		this.colorTex = gl.createTexture()
		gl.activeTexture(gl["TEXTURE" + 2])
		gl.bindTexture(gl.TEXTURE_2D, this.colorTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

		this.weightTex = gl.createTexture()
		gl.activeTexture(gl["TEXTURE" + 3])
		gl.bindTexture(gl.TEXTURE_2D, this.weightTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.colorTex, 0)
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.weightTex, 0)

		this.drawBuffers = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]
		gl.drawBuffers(this.drawBuffers)

		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    setStyles() {
        glcanvas.style.position = "absolute"
        glcanvas.style.left = 0
        glcanvas.style.top = 0
        document.body.style.overflow = "hidden"
    }
    resizeCanvas() {
        glcanvas.width = window.innerWidth
        glcanvas.height = window.innerHeight
    }
	sortObjs() {
		return
		this.meshes.sort((a, b) => a.rOrder - b.rOrder)
	}
    setView(camera) {
        if (!window.mat4) return
        view = mat4.create()
        mat4.translate(view, view, [camera.pos.x, camera.pos.y, camera.pos.z])
        mat4.rotateY(view, view, camera.rot.y)
        mat4.rotateX(view, view, camera.rot.x)
        mat4.rotateZ(view, view, camera.rot.z)
        mat4.invert(view, view)
    }
    setupFrame(colour=[0, 0, 0, 1]) {
        if (!window.mat4) return
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(...colour)
		this.bg = colour
        gl.clear(gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.enable(gl.DEPTH_TEST)

        gl.enable(gl.BLEND)
        gl.clear(gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        mat4.perspective(projection, fov * Math.PI / 180, gl.canvas.width / gl.canvas.height, 0.01, 5000)

        gl.enable(gl.DEPTH_TEST)
    }
	setupModels() {
		this.modelData = []
		for (let mesh of this.meshes) {
			this.modelData.push(...mesh.getModel())
			// console.log(mesh)
			// this.modelData.
		}

	}

	doRender = true
	render() {
        if (!window.mat4) return
		this.rendering = 0
		this.cId = ""
		// this.setupModels()
		// console.log("new frame")

		this.update()
		this.sortCooldown -= 1*60*delta
		if (this.sortCooldown <= 0) {
			this.sortCooldown = 30
			this.sortObjs()
		}
		this.ri = 0

		let solid = []
		let transparent = []
		let ignoreDepth = []

		for (let mesh of this.meshes) {
			if (this.doRender && mesh.visible && mesh.vertices.length > 0) {
				if (mesh.ignoreDepth) {
					ignoreDepth.push(mesh)
				} else if (mesh.alpha < 1 || mesh.useAlpha == true) {
					transparent.push(mesh)
				} else {
					solid.push(mesh)
				}
			}
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.sFrameBuffer)
		gl.clearColor(...this.bg)
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
		
		gl.enable(gl.DEPTH_TEST)
		gl.disable(gl.BLEND)
		gl.depthMask(true)

		
		gl.activeTexture(gl["TEXTURE" + 1])
		gl.bindTexture(gl.TEXTURE_2D, this.sColourTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
		
		gl.activeTexture(gl["TEXTURE" + 0])
		gl.bindTexture(gl.TEXTURE_2D, this.sDistanceTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.FLOAT, null)
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, glcanvas.width, glcanvas.height)

		this.renderMeshes(solid)

		gl.disable(gl.DEPTH_TEST)
		gl.enable(gl.BLEND)
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

		gl.bindFramebuffer(gl.FRAMEBUFFER, null)

		this.setProgram(this.scVertexShader, this.scFragmentShader, {}, this.scUniforms)
		gl.activeTexture(gl["TEXTURE" + 1])
		gl.bindTexture(gl.TEXTURE_2D, this.sColourTex)
		gl.activeTexture(gl["TEXTURE" + 0])
		gl.bindTexture(gl.TEXTURE_2D, this.sDistanceTex)
		gl.uniform1i(this.uniforms.colourTexture, 1)
		gl.uniform1i(this.uniforms.distanceTexture, 0)

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)





		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
		gl.clearColor(...this.bg)
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)

		gl.enable(gl.BLEND)
    	gl.blendFunc(gl.ONE, gl.ONE)

		gl.activeTexture(gl["TEXTURE" + 0])
		gl.bindTexture(gl.TEXTURE_2D, this.sDistanceTex)
		
		gl.activeTexture(gl["TEXTURE" + 1])
		gl.bindTexture(gl.TEXTURE_2D, this.colorTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.FLOAT, null)
		
		gl.activeTexture(gl["TEXTURE" + 2])
		gl.bindTexture(gl.TEXTURE_2D, this.weightTex)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, glcanvas.width, glcanvas.height, 0, gl.RGBA, gl.FLOAT, null)

		gl.disable(gl.DEPTH_TEST)
		gl.depthMask(false)

		this.renderMeshes(transparent)


		gl.depthMask(true)
		gl.disable(gl.DEPTH_TEST)
		gl.enable(gl.BLEND)
    	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

		gl.bindFramebuffer(gl.FRAMEBUFFER, null)

		this.setProgram(this.cVertexShader, this.cFragmentShader, {}, this.cUniforms)
		gl.activeTexture(gl["TEXTURE" + 1])
		gl.bindTexture(gl.TEXTURE_2D, this.colorTex)
		gl.activeTexture(gl["TEXTURE" + 2])
		gl.bindTexture(gl.TEXTURE_2D, this.weightTex)
		gl.uniform1i(this.uniforms.accumTexture, 1)
		gl.uniform1i(this.uniforms.revealTexture, 2)

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
		



		gl.depthMask(false)

		gl.disable(gl.DEPTH_TEST)
		mat4.perspective(projection, 60 * Math.PI/180, gl.canvas.width / gl.canvas.height, 0.01, 5000)
		this.update()

		this.renderMeshes(ignoreDepth)
	}
	setProgram(vertexShader, fragmentShader, attributes, uniforms, transparent=false) {
		let id = vertexShader+"|"+fragmentShader
		if (id == this.cId) return
		if (!(id in this.programCache)) {
			let program = gl.createProgram()
			let vertexShaderGL = gl.createShader(gl.VERTEX_SHADER)
			gl.shaderSource(vertexShaderGL, vertexShader)
			gl.compileShader(vertexShaderGL)
			let fragmentShaderGL = gl.createShader(gl.FRAGMENT_SHADER)
			gl.shaderSource(fragmentShaderGL, fragmentShader)
			gl.compileShader(fragmentShaderGL)
			gl.attachShader(program, vertexShaderGL)
			gl.attachShader(program, fragmentShaderGL)
			gl.linkProgram(program)

			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				console.log(gl.getShaderInfoLog(vertexShaderGL))
				console.log(gl.getShaderInfoLog(fragmentShaderGL))
			} 
			this.programCache[id] = program
			this.attributeCache[id] = {}
			this.uniformCache[id] = {}
			this.uniformVCache[id] = {}
			for (let key in attributes) {
				this.attributeCache[id][key] = gl.getAttribLocation(program, attributes[key])
			}
			for (let key in uniforms) {
				this.uniformCache[id][key] = gl.getUniformLocation(program, uniforms[key])
				this.uniformVCache[id][key] = null
			}
			gl.useProgram(this.programCache[id])
		} else {
			gl.useProgram(this.programCache[id])
		}
		// console.log("changing program")
		this.attributes = this.attributeCache[id]
		this.uniforms = this.uniformCache[id]
		this.uniformsV = this.uniformVCache[id]
		this.cId = id

		if (transparent) {
			gl.uniform1i(this.uniforms.distanceTexture, 0)
		}
	}
	setUniform(id, name, type, ...value) {
		this.setProgram(...id.split("|"))
		if (this.uniformsV[name] != JSON.stringify(value)) {
			gl["uniform"+type](this.uniforms[name], ...value)
			this.uniformsV[name] = JSON.stringify(value)
		}
	}
	renderMeshes(meshes) {
		for (let mesh of meshes) {
			this.rendering++
			mesh.render()
		}
	}
	update() {
		this.updateView = JSON.stringify(view) != JSON.stringify(this.lastView)
		this.lastView = {...view}
		this.updateProjection = JSON.stringify(projection) != JSON.stringify(this.lastProjection)
		this.lastProjection = {...projection}
		
		for (let id in this.uniformCache) {
			this.setProgram(...id.split("|"))
			gl.uniformMatrix4fv(this.uniforms.view, false, view)
			gl.uniformMatrix4fv(this.uniforms.projection, false, projection)
		}
	}
	
	get Texture() {
		return class {
			img
			src
			id
			texture
			constructor(src, filter=false) {
				this.img = new Image()
				this.img.src = src
				this.src = src
				this.id = webgl.gId
				webgl.gId += 1
				var img = this.img
				var id = this.id
				img.onload = function () {
					gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
	
					let texture2 = gl.createTexture()
					gl.activeTexture(gl["TEXTURE" + id])
					gl.bindTexture(gl.TEXTURE_2D, texture2)
					gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
					if (filter) {
						gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
						gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
					} else {
						gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
						gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
					}
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
				}
			}
		}
	}
	
	get Mesh() {
		return class {
			pos = {x: 0, y: 0, z: 0}
			size = {x: 1, y: 1, z: 1}
			rot = {x: 0, y: 0, z: 0}
			vertices = []
			faces = []
			colours = []
			uvs = []
			vertexBuffer
			faceBuffer
			uvBuffer
			colourBuffer
			customBuffers = {}
			useTexture = false
			useAlpha = false
			texture
			order = false
			alphaTexture
			rOrder = 0
			orderCooldown = 0
			sort = false
			vertexLocation = 0
			oneSide = false
			rotOff = {x: 0, y: 0, z: 0}
			vao
			updateTextures = true
			needSetup = true
			visible = true
			ignoreDepth = false
			customRot = []
			customRotOff = []
			ignoreFog = false
			originalFaces = []
            alpha = 1
			customModel = null
			vertexShader = ""
			fragmentShader = ""
			tVertexShader = ""
			tFragmentShader
			uvD = 2
			program
			uniforms = {}
			attributes = {}
			tUniforms = {}
			tAttributes = {}
			gotView = false
			gotProjection = false
			overrideT = false
			constructor(x, y, z, width, height, depth, vertices, faces, colours) {
				this.pos = {x: x, y: y, z: z}
				this.size = {x: width, y: height, z: depth}
				this.vertices = vertices
				this.faces = faces
				this.colours = colours

				webgl.meshes.push(this)

				this.vertexBuffer = gl.createBuffer()
				this.facesBuffer = gl.createBuffer()
				this.uvBuffer = gl.createBuffer()
				this.colourBuffer = gl.createBuffer()
				this.vao = gl.createVertexArray()

				gl.bindVertexArray(this.vao)

				this.vertexShader = webgl.vertexShader
				this.fragmentShader = webgl.fragmentShader
				this.attributes = webgl.dAttributes
				this.uniforms = webgl.dUniforms

				this.tVertexShader = webgl.tVertexShader
				this.tFragmentShader = webgl.tFragmentShader
				this.tAttributes = webgl.tAttributes
				this.tUniforms = webgl.tUniforms
			}
			createBuffer(name, attribName, dim) {
				this.customBuffers[name] = {buffer: gl.createBuffer()}
				this.customBuffers[name].attrib = attribName
				this.customBuffers[name].dim = dim
			}
			setBuffer(name, value) {
				this.customBuffers[name].value = value
			}
			addUniform(name, shaderName) {
				this.uniforms[name] = gl.getUniformLocation(this.program, shaderName)
			}
			addAttribute(name, shaderName) {
				this.attributes[name] = gl.getAttribLocation(this.program, shaderName)
			}
			updateBuffers() {
				webgl.setProgram(this.vertexShader, this.fragmentShader, this.attributes, this.uniforms)
				this.originalFaces = [...this.faces]
				this.vao = gl.createVertexArray()
				gl.bindVertexArray(this.vao)
				
				gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW)
				gl.enableVertexAttribArray(webgl.attributes.vertices)
				gl.vertexAttribPointer(webgl.attributes.vertices, 3, gl.FLOAT, false, 0, 0)
				
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.facesBuffer)
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.faces), gl.DYNAMIC_DRAW)
				
				gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.uvs), gl.STATIC_DRAW)
				gl.enableVertexAttribArray(webgl.attributes.uvs)
				gl.vertexAttribPointer(webgl.attributes.uvs, this.uvD, gl.FLOAT, false, 0, 0)	

				gl.bindBuffer(gl.ARRAY_BUFFER, this.colourBuffer)
        		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colours), gl.STATIC_DRAW)
				gl.enableVertexAttribArray(webgl.attributes.colours)
				gl.vertexAttribPointer(webgl.attributes.colours, 3, gl.FLOAT, false, 0, 0)

				for (let buffer in this.customBuffers) {
					gl.bindBuffer(gl.ARRAY_BUFFER, this.customBuffers[buffer].buffer)
					gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.customBuffers[buffer].value), gl.STATIC_DRAW)
					gl.enableVertexAttribArray(this.attributes[this.customBuffers[buffer].attrib])
					gl.vertexAttribPointer(this.attributes[this.customBuffers[buffer].attrib], this.customBuffers[buffer].dim, gl.FLOAT, false, 0, 0)
				}
				
				gl.bindVertexArray(null)
			}
			doCustomOrderUpdate = false
			customOrderUpdate() {
				
			}
			updateBufferF() {
				if (this.doCustomOrderUpdate) {this.customOrderUpdate(); return}
				webgl.setProgram(this.vertexShader, this.fragmentShader, this.attributes, this.uniforms)
				// this.vao = gl.createVertexArray()
				gl.bindVertexArray(this.vao)
				
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.facesBuffer)
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new  Uint32Array(this.faces), gl.DYNAMIC_DRAW)
		
				gl.bindVertexArray(null)
			}
			orderFaces(actual = false) {
				return
				this.faces = [...this.originalFaces]
				let ds = []
				for (let i = 0; i < this.faces.length; i += 3) {
					let v1 = [this.vertices[this.faces[i]*3], this.vertices[this.faces[i]*3+1], this.vertices[this.faces[i]*3+2]]
					let v2 = [this.vertices[this.faces[i+1]*3], this.vertices[this.faces[i+1]*3+1], this.vertices[this.faces[i+1]*3+2]]
					let v3 = [this.vertices[this.faces[i+2]*3], this.vertices[this.faces[i+2]*3+1], this.vertices[this.faces[i+2]*3+2]]
					let pos = [Math.round((v1[0]+v2[0]+v3[0])/3*2)/2, Math.round((v1[1]+v2[1]+v3[1])/3*2)/2, Math.round((v1[2]+v2[2]+v3[2])/3*2)/2]
					ds.push([i, ((pos[0]-(camera.pos.x-this.pos.x))**2 + (pos[1]-(camera.pos.y-this.pos.y))**2 + (pos[2]-(camera.pos.z-this.pos.z))**2)])
				}
				ds.sort((a, b) => b[1] - a[1])
				let newFaces = []
				for (let sorted of ds) {
					newFaces.push(this.faces[sorted[0]], this.faces[sorted[0]+1], this.faces[sorted[0]+2])
					// let light = 5 - sorted[1]
					// this.colours[newFaces[sorted[0]]*3] = 1; this.colours[newFaces[sorted[0]]*3+1] = 0; this.colours[newFaces[sorted[0]]*3+2] = 0
					// this.colours[newFaces[sorted[0]+1]*3] = 1; this.colours[newFaces[sorted[0]+1]*3+1] = 0; this.colours[newFaces[sorted[0]+1]*3+2] = 0
					// this.colours[newFaces[sorted[0]+2]*3] = 1; this.colours[newFaces[sorted[0]+2]*3+1] = 0; this.colours[newFaces[sorted[0]+2]*3+2] = 0
				}
				this.faces = newFaces
				this.updateBufferF()
			}
			getModel() {
				let model = mat4.create()
				this.pos.x -= this.rotOff.x
				this.pos.y -= this.rotOff.y
				this.pos.z -= this.rotOff.z
				mat4.translate(model, model, [this.pos.x, this.pos.y, this.pos.z])
				if (this.customRotOff.length > 0) {
					mat4.translate(model, model, [this.customRotOff[0].x, this.customRotOff[0].y, this.customRotOff[0].z])
				}
				mat4.rotateY(model, model, this.rot.y)
				if (this.customRotOff.length > 0) {
					mat4.translate(model, model, [-this.customRotOff[0].x, -this.customRotOff[0].y, -this.customRotOff[0].z])
				}
				if (this.customRotOff.length > 1) {
					mat4.translate(model, model, [this.customRotOff[1].x, this.customRotOff[1].y, this.customRotOff[1].z])
				}
				mat4.rotateX(model, model, this.rot.x)
				if (this.customRotOff.length > 1) {
					mat4.translate(model, model, [-this.customRotOff[1].x, -this.customRotOff[1].y, -this.customRotOff[1].z])
				}
				if (this.customRotOff.length > 2) {
					mat4.translate(model, model, [this.customRotOff[2].x, this.customRotOff[2].y, this.customRotOff[2].z])
				}
				mat4.rotateY(model, model, this.rot.z)
				if (this.customRotOff.length > 2) {
					mat4.translate(model, model, [-this.customRotOff[2].x, -this.customRotOff[2].y, -this.customRotOff[2].z])
				}
				let i = 0
				for (let rot of this.customRot) {
					if (this.customRotOff.length > i+3) {
						mat4.translate(model, model, [this.customRotOff[i+3].x, this.customRotOff[i+3].y, this.customRotOff[i+3].z])
					}
					if (rot[0] == "X") {
						mat4.rotateX(model, model, rot[1])
					}
					if (rot[0] == "Y") {
						mat4.rotateY(model, model, rot[1])
					}
					if (rot[0] == "Z") {
						mat4.rotateZ(model, model, rot[1])
					}
					if (this.customRotOff.length > i+3) {
						mat4.translate(model, model, [-this.customRotOff[i+3].x, -this.customRotOff[i+3].y, -this.customRotOff[i+3].z])
					}
					i++
				}
				mat4.translate(model, model, [this.rotOff.x, this.rotOff.y, this.rotOff.z])
				mat4.scale(model, model, [this.size.x, this.size.y, this.size.z])
				this.pos.x += this.rotOff.x
				this.pos.y += this.rotOff.y
				this.pos.z += this.rotOff.z
				return model
			}
			setUniform(name, type, ...value) {
				webgl.setUniform(this.vertexShader+"|"+this.fragmentShader, name, type, ...value)
			}
			doCustomRender = false
			customRender() {

			}
			render() {
				if (this.vertices.length <= 0 || !this.visible) {
					return
				}
				let transparent = this.alpha < 1 || (this.useAlpha && this.alphaTexture)

				if (!transparent) webgl.setProgram(this.vertexShader, this.fragmentShader, this.attributes, this.uniforms)
				else webgl.setProgram(this.tVertexShader, this.tFragmentShader, this.tAttributes, this.tUniforms, true)
				
				// let webglUniforms
				// let webglAttributes
				// if (this.customFShader || this.customVShader) {
				// 	gl.useProgram(this.program)
				// 	webglUniforms = webgl.uniforms
				// 	webglAttributes = webgl.attributes
				// 	webgl.uniforms = this.uniforms
				// 	webgl.attributes = this.attributes
				// }

				if (this.ignoreFog) {
					// this.setUniform("rDistance", "1f", 200)
					gl.uniform1f(webgl.uniforms.rDistance, 200)
				}

				// if (this.ignoreDepth) {
				// 	gl.disable(gl.DEPTH_TEST)
				// 	// gl.depthMask(false)
					
				// 	// gl.depthFunc(gl.LEQUAL)
				// } else {
				// 	// gl.depthFunc(gl.LESS)
				// 	gl.enable(gl.DEPTH_TEST)
				// 	// gl.depthMask(true)
				// }
				
				if (this.oneSide) {
					gl.enable(gl.CULL_FACE)
					gl.cullFace(gl.BACK)
				} else {
					gl.disable(gl.CULL_FACE)
				}
				
				this.orderCooldown -= delta
				if (this.order && this.orderCooldown <= 0) {
					this.orderCooldown = 1
					this.orderFaces()
				}
				let model
				if (this.customModel) {
					model = this.customModel
				} else {
					model = this.getModel()
				}

				gl.uniform1i(webgl.uniforms.uDistanceTexture, 2)
				if (this.updateTextures) {
					// this.updateTextures = false
					// this.setUniform("useTexture", "1i", this.useTexture)
					gl.uniform1i(webgl.uniforms.useTexture, this.useTexture ? 1 : 0)
					gl.uniform1i(webgl.uniforms.texture, this.useTexture && this.texture ? this.texture.id : webgl.gId)
					// if (this.useTexture) {
					// 	// this.setUniform("texture", "1i", this.texture.id)
					// 	gl.uniform1i(webgl.uniforms.texture, this.texture.id)
					// }
					// this.setUniform("useAlphaMap", "1i", this.useAlpha)
					gl.uniform1i(webgl.uniforms.useAlphaMap, this.useAlpha)
					if (this.useAlpha) {
						// this.setUniform("alpha", "1i", this.alphaTexture.id)
						gl.uniform1i(webgl.uniforms.alpha, this.alphaTexture.id)
					}
				}
				// this.setUniform("model", "Matrix4fv", false, model)
				gl.uniformMatrix4fv(webgl.uniforms.model, false, model)
				// this.setUniform("alpha2", "1f", this.alpha)
                gl.uniform1f(webgl.uniforms.alpha2, this.alpha)

				if (this.doCustomRender) {
					this.customRender()
				} else {
					gl.bindVertexArray(this.vao)

					if ((this.useTexture && this.texture) || (this.useAlpha && this.alphaTexture)) {
						gl.enableVertexAttribArray(webgl.attributes.uvs)
					} else {
						gl.disableVertexAttribArray(webgl.attributes.uvs)
					}
				}
				gl.drawElements(gl.TRIANGLES, this.faces.length, gl.UNSIGNED_INT, 0)
				gl.bindVertexArray(null)

				if (this.ignoreFog) {
					// this.setUniform("rDistance", "1f", webgl.rDistance)
					gl.uniform1f(webgl.uniforms.rDistance, webgl.rDistance)
				}
			}
			delete() {
				webgl.meshes.splice(webgl.meshes.indexOf(this), 1)
			}
		}
	}
	get Box() {
		return class extends webgl.Mesh {
			lastColour = []
			colour = [0, 0, 0]
			visible = true
			shading = true
			constructor(x, y, z, width, height, depth, colour, centerRot=true) {
				super(x, y, z, width, height, depth, [
					// +X
					1, 1, 1,
					1, 0, 0,
					1, 1, 0,
					1, 0, 1,
					// -X
					0, 1, 1,
					0, 0, 0,
					0, 1, 0,
					0, 0, 1,
					// +Y
					1, 1, 1,
					0, 1, 0,
					1, 1, 0,
					0, 1, 1,
					// -Y
					1, 0, 1,
					0, 0, 0,
					1, 0, 0,
					0, 0, 1,
					// +Z
					1, 1, 0,
					0, 0, 0,
					1, 0, 0,
					0, 1, 0,
					// -Z
					1, 1, 1,
					0, 0, 1,
					1, 0, 1,
					0, 1, 1,
				],[
					// +Z
					18, 17, 16,
					16, 17, 19,
					// -X
					6, 5, 4,
					4, 5, 7,
					// +X
					0, 1, 2,
					3, 1, 0,
					// -Z
					20, 21, 22,
					23, 21, 20,
					// -Y
					12, 13, 14,
					15, 13, 12,
					// +Y
					10, 9, 8,
					8, 9, 11,
				])
				this.oneSide = true
				this.colour = colour
				if (centerRot) {
					this.rotOff = {x: -width/2, y: -height/2, z: -depth/2}
				}
			}
            setUvs(offx=0, offy=0, offw=1, offh=1) {
                this.uvs = []
                for (let i = 0; i < 6; i++) {
                    this.uvs.push(
                        offx+offw, offy+offh,
                        0, 0,
                        0, offy+offh,
                        offx+offw, 0,
                    )
                }
                this.updateBuffers()
            }
			updateShape(o=0) {
				this.vertices = [
					// +X
					1-o, 1, 1,
					1-o, 0, 0,
					1-o, 1, 0,
					1-o, 0, 1,
					// -X
					0+o, 1, 1,
					0+o, 0, 0,
					0+o, 1, 0,
					0+o, 0, 1,
					// +Y
					1, 1-o, 1,
					0, 1-o, 0,
					1, 1-o, 0,
					0, 1-o, 1,
					// -Y
					1, 0+o, 1,
					0, 0+o, 0,
					1, 0+o, 0,
					0, 0+o, 1,
					// +Z
					1, 1, 0+o,
					0, 0, 0+o,
					1, 0, 0+o,
					0, 1, 0+o,
					// -Z
					1, 1, 1-o,
					0, 0, 1-o,
					1, 0, 1-o,
					0, 1, 1-o,
				]
			}
			render() {
				if (!this.visible) { return }
				if (JSON.stringify(this.colour) != JSON.stringify(this.lastColour)) {
					this.colours = []
					if (this.shading) {
						// +X
						for (let i = 0; i < 4; i++) {
							this.colours.push(this.colour[0]*0.85, this.colour[1]*0.85, this.colour[2]*0.85)
						}
						// -X
						for (let i = 0; i < 4; i++) {
							this.colours.push(this.colour[0]*0.7, this.colour[1]*0.7, this.colour[2]*0.7)
						}
						// +Y
						for (let i = 0; i < 4; i++) {
							this.colours.push(this.colour[0]*1, this.colour[1]*1, this.colour[2]*1)
						}
						// -Y
						for (let i = 0; i < 4; i++) {
							this.colours.push(this.colour[0]*0.55, this.colour[1]*0.55, this.colour[2]*0.55)
						}
						// +Z
						for (let i = 0; i < 4; i++) {
							this.colours.push(this.colour[0]*0.75, this.colour[1]*0.75, this.colour[2]*0.75)
						}
						// -Z
						for (let i = 0; i < 4; i++) {
							this.colours.push(this.colour[0]*0.6, this.colour[1]*0.6, this.colour[2]*0.6)
						}
					} else {
						for (let i = 0; i < 4*6; i++) {
							this.colours.push(this.colour[0]*1, this.colour[1]*1, this.colour[2]*1)
						}
					}
					
					this.updateBuffers()
				}
				this.lastColour = [...this.colour]
				this.pos.x -= this.size.x/2
				this.pos.y -= this.size.y/2
				this.pos.z -= this.size.z/2
				super.render()
				this.pos.x += this.size.x/2
				this.pos.y += this.size.y/2
				this.pos.z += this.size.z/2
			}
		}
	}
	get Group() {
		return class {
			pos = {x: 0, y: 0, z: 0}
			size = {x: 1, y: 1, z: 1}
			rot = {x: 0, y: 0, z: 0}
			isChild = false
			customRot = []
			meshes = []
			constructor(x, y, z, meshes=[]) {
				this.pos = {x:x, y:y, z:z}
				this.meshes = meshes
			}
			update() {
				for (let mesh of this.meshes) {
					mesh.oldPos = {...mesh.pos}
					mesh.oldRot = {...mesh.rot}
					let rotated = rotv3(mesh.pos, this.rot)
					if (this.isChild) {
						rotated = rotv3(mesh.pos, addv3(this.oldRot, this.rot))
					}
					mesh.pos = addv3(rotated, this.pos)
					mesh.rot = {...this.rot}
					mesh.customRot.push(...this.customRot)
					mesh.customRot.push(
						["Y", mesh.oldRot.y],
						["X", mesh.oldRot.x],
						["Y", mesh.oldRot.z],
					)
					mesh.isChild = true
				}
			}
			aRender() {
				for (let mesh of this.meshes) {
					mesh.pos = {...mesh.oldPos}
					mesh.rot = {...mesh.oldRot}
					mesh.customRot = []
					mesh.isChild = false
				}
			}
		}
	}
    get Points() {
        return class {
            points = []
            colours = []
            visible = true
            alpha = 1
            vertexBuffer
            colourBuffer
            vao
            constructor(points) {
                webgl.meshes.push(this)

                this.vertexBuffer = gl.createBuffer()
				this.colourBuffer = gl.createBuffer()
				this.vao = gl.createVertexArray()

				gl.bindVertexArray(this.vao)

                this.setPoints(points)
            }
            setPoints(points) {
                this.points = []
                this.colours = []
                for (let point of points) {
                    this.points.push(point.x, point.y, point.z)
                    this.colours.push(...point.c)
                }

                this.updateBuffers()
            }
            updateBuffers() {
				this.vao = gl.createVertexArray()
				gl.bindVertexArray(this.vao)
				gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
        		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.points), gl.STATIC_DRAW)
				gl.enableVertexAttribArray(webgl.attributes.vertices)
				gl.vertexAttribPointer(webgl.attributes.vertices, 3, gl.FLOAT, false, 0, 0)

				gl.bindBuffer(gl.ARRAY_BUFFER, this.colourBuffer)
        		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colours), gl.STATIC_DRAW)
				gl.enableVertexAttribArray(webgl.attributes.colours)
				gl.vertexAttribPointer(webgl.attributes.colours, 3, gl.FLOAT, false, 0, 0)
				
				gl.bindVertexArray(null)
            }
            render() {
                if (this.points.length <= 0 || !this.visible) {
					return
				}

				if (this.ignoreFog) {
					gl.uniform1f(webgl.uniforms.rDistance, 200)
				}
				
				let model = mat4.create()

                gl.uniform1i(webgl.uniforms.useTexture, false)

				gl.uniformMatrix4fv(webgl.uniforms.model, false, model)
                gl.uniform1f(webgl.uniforms.alpha2, this.alpha)

				gl.bindVertexArray(this.vao)

                gl.disableVertexAttribArray(webgl.attributes.uvs)
				
				gl.drawArrays(gl.POINTS, 0, this.points.length / 3)
				gl.bindVertexArray(null)

				if (this.ignoreFog) {
					gl.uniform1f(webgl.uniforms.rDistance, webgl.rDistance)
				}
            }
        }
    }
    get Sphere() {
        return class extends webgl.Mesh {
            radius = 0
            colour = [0, 0, 0]
            res = 30
            constructor(x, y, z, radius, colour, res=30) {
                super(x, y, z, 1, 1, 1, [], [], [])
                this.radius = radius
                this.colour = colour
				this.res = res
                this.updateMesh()
                this.updateBuffers()
            }
            updateMesh() {
                this.vertices = []
                this.faces = []
                this.colours = []
                for (let lat = 0; lat <= this.res; lat++) {
                    const theta = (lat * Math.PI) / this.res;
                    const sinTheta = Math.sin(theta)
                    const cosTheta = Math.cos(theta)

                    for (let lon = 0; lon <= this.res; lon++) {
                        const phi = (lon * 2 * Math.PI) / this.res
                        const sinPhi = Math.sin(phi)
                        const cosPhi = Math.cos(phi)

                        const x = cosPhi * sinTheta
                        const y = cosTheta
                        const z = sinPhi * sinTheta

                        this.vertices.push(this.radius * x, this.radius * y, this.radius * z)

                        let normal = normalv3({x:x, y:y, z:z})

                        let ld = normalv3(lightD)
                        let light = Math.max(0.1, Math.min(1, normal.x*ld.x+normal.y*ld.y+normal.z*ld.z))

                        this.colours.push(this.colour[0]*light, this.colour[1]*light, this.colour[2]*light)
                    }
                }
                for (let lat = 0; lat < this.res; lat++) {
                    for (let lon = 0; lon < this.res; lon++) {
                        const first = lat * (this.res + 1) + lon
                        const second = first + this.res + 1
                        this.faces.push(first + 1, second, first, first + 1, second + 1, second)
                    }
                }
            }
        }
    }
}
var webgl = new Webgl()