import * as THREE from 'three';

export const EarthShader = {
  uniforms: {
    dayMap: { value: null },
    nightMap: { value: null },
    sunDirection: { value: new THREE.Vector3(1, 0, 0) },
    moonPosition: { value: new THREE.Vector3(-10, 0, 0) },
    dayMapTexelSize: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
    nightMapTexelSize: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
    cameraDistance: { value: 6 },
    surfaceDetailEnabled: { value: 1 },
    sunBrightness: { value: 1.4 },
  },

  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      // Calculate normal in world space
      vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      // Calculate world position
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,

  fragmentShader: `
    uniform sampler2D dayMap;
    uniform sampler2D nightMap;
    uniform vec3 sunDirection;
    uniform vec3 moonPosition;
    uniform vec2 dayMapTexelSize;
    uniform vec2 nightMapTexelSize;
    uniform float cameraDistance;
    uniform float surfaceDetailEnabled;
    uniform float sunBrightness;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    const float DAY_AMBIENT_STRENGTH = 0.1;
    const float DAY_DIFFUSE_STRENGTH = 1.2;
    const float DAYLIGHT_BOOST = 1.1;
    const float SURFACE_RELIEF_STRENGTH = 0.45;

    float sampleDayLuma(vec2 uv) {
      return dot(texture2D(dayMap, uv).rgb, vec3(0.299, 0.587, 0.114));
    }

    float sampleNightLuma(vec2 uv) {
      return dot(texture2D(nightMap, uv).rgb, vec3(0.299, 0.587, 0.114));
    }

    vec3 enhanceDayDetail(vec2 uv, vec3 baseColor, float strength) {
      float center = dot(baseColor, vec3(0.299, 0.587, 0.114));
      float neighborhood = (
        sampleDayLuma(uv + vec2(dayMapTexelSize.x, 0.0)) +
        sampleDayLuma(uv - vec2(dayMapTexelSize.x, 0.0)) +
        sampleDayLuma(uv + vec2(0.0, dayMapTexelSize.y)) +
        sampleDayLuma(uv - vec2(0.0, dayMapTexelSize.y))
      ) * 0.25;

      float highFrequency = clamp(center - neighborhood, -0.35, 0.35);

      return clamp(baseColor + vec3(highFrequency * strength), 0.0, 1.0);
    }

    vec3 enhanceNightDetail(vec2 uv, vec3 baseColor, float strength) {
      float center = dot(baseColor, vec3(0.299, 0.587, 0.114));
      float neighborhood = (
        sampleNightLuma(uv + vec2(nightMapTexelSize.x, 0.0)) +
        sampleNightLuma(uv - vec2(nightMapTexelSize.x, 0.0)) +
        sampleNightLuma(uv + vec2(0.0, nightMapTexelSize.y)) +
        sampleNightLuma(uv - vec2(0.0, nightMapTexelSize.y))
      ) * 0.25;

      float highFrequency = clamp(center - neighborhood, -0.35, 0.35);

      return clamp(baseColor + vec3(highFrequency * strength), 0.0, 1.0);
    }

    vec3 deriveSurfaceNormal(vec2 uv, vec3 baseNormal, float strength) {
      float left = sampleDayLuma(uv - vec2(dayMapTexelSize.x, 0.0));
      float right = sampleDayLuma(uv + vec2(dayMapTexelSize.x, 0.0));
      float down = sampleDayLuma(uv - vec2(0.0, dayMapTexelSize.y));
      float up = sampleDayLuma(uv + vec2(0.0, dayMapTexelSize.y));

      vec3 tangent = normalize(vec3(-baseNormal.z, 0.0, baseNormal.x));
      vec3 bitangent = normalize(cross(baseNormal, tangent));
      vec3 reliefOffset = tangent * (right - left) + bitangent * (up - down);

      return normalize(baseNormal + reliefOffset * strength);
    }

    void main() {
      // Sample textures
      vec4 dayColor = texture2D(dayMap, vUv);
      vec4 nightColor = texture2D(nightMap, vUv);
      float detailFade = (1.0 - smoothstep(6.5, 11.0, cameraDistance)) * surfaceDetailEnabled;
      vec3 enhancedDayColor = enhanceDayDetail(vUv, dayColor.rgb, 0.28 * detailFade);
      vec3 enhancedNightColor = enhanceNightDetail(vUv, nightColor.rgb, 0.18 * detailFade);
      vec3 daySurfaceColor = mix(dayColor.rgb, enhancedDayColor, surfaceDetailEnabled);
      vec3 nightSurfaceColor = mix(nightColor.rgb, enhancedNightColor, surfaceDetailEnabled);

      vec3 modifiedNormal = deriveSurfaceNormal(
        vUv,
        normalize(vNormal),
        SURFACE_RELIEF_STRENGTH * detailFade
      );

      // Calculate lighting intensity (dot product)
      float dotNL = dot(modifiedNormal, normalize(sunDirection));

      // Smoothstep to create a twilight zone (transition between day and night)
      float dayMix = smoothstep(-0.2, 0.2, dotNL);

      // Night lights should be bright where it's dark
      vec3 finalNightColor = nightSurfaceColor * (1.0 - dayMix) * (1.5 + 0.2 * detailFade);

      // Base lighting for the day side (ambient + diffuse)
      vec3 ambient = vec3(DAY_AMBIENT_STRENGTH * mix(0.85, 1.25, clamp(sunBrightness / 2.5, 0.0, 1.0)));
      vec3 diffuse = daySurfaceColor * max(dotNL, 0.0) * DAY_DIFFUSE_STRENGTH * sunBrightness;
      
      vec3 finalDayColor = (diffuse + ambient * daySurfaceColor) * DAYLIGHT_BOOST;

      // Moonlight on the night side
      vec3 moonDir = normalize(moonPosition - vWorldPosition);
      float moonDotNL = max(dot(modifiedNormal, moonDir), 0.0);
      vec3 moonlightColor = vec3(0.1, 0.12, 0.18) * moonDotNL * 0.15; // Soft reflection from moon

      // Mix day and night based on light incidence
      vec3 finalColor = finalDayColor * dayMix + finalNightColor + (moonlightColor * (1.0 - dayMix));

      gl_FragColor = vec4(finalColor, 1.0);
      
      // Basic tone mapping (simple ACES approximation for shader)
      gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
    }
  `
};
