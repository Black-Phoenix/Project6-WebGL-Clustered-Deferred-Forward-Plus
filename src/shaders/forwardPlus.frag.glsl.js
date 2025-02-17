export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform float u_nearClip;
  uniform float u_farClip;
  uniform float u_nearWidth;
  uniform float u_nearHeight;
  uniform float u_farWidth;
  uniform float u_farHeight;

  uniform float u_xSlices;
  uniform float u_ySlices;
  uniform float u_zSlices;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;
  varying vec4 v_viewPosition;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }
  int GetNumLights(int cellx, int celly, int cellz)
  {
    return 0;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    // 1. Calculate the Slice index which the fragment is in
    float proportion = ( (abs(v_viewPosition.z) - u_nearClip)/(1.0 * u_farClip - u_nearClip) );
    float sliceWidth = u_nearWidth + (u_farWidth - u_nearWidth) * proportion;
    float sliceHeight = u_nearHeight + (u_farHeight - u_nearHeight) * proportion;
    int cellX = int((v_viewPosition.x + 0.5 * sliceWidth) / (sliceWidth / u_xSlices));
    int cellY = int((v_viewPosition.y + 0.5 * sliceHeight) / (sliceHeight / u_ySlices));
    int cellZ = int((abs(v_viewPosition.z) - u_nearClip) / ((u_farClip - u_nearClip) / u_zSlices));
    
    // 2. Find out the number of lights and their indices
    int index = cellX + cellY * int(u_xSlices) + cellZ * int(u_xSlices * u_ySlices);
  
    int numLights = int(ExtractFloat(u_clusterbuffer, ${params.clusterTextureWidth}, ${params.clusterTextureHeight}, index, 0));
    
    // 3. Iterate through the lights
    for(int lightIndex = 1; lightIndex < ${params.clusterTextureHeight} * 4 - 1; ++lightIndex)
    {
    
      if(lightIndex > numLights)
      {
      break;
      }
    
      int lightId = int(ExtractFloat(u_clusterbuffer, ${params.clusterTextureWidth}, ${params.clusterTextureHeight}, index, lightIndex));
      
      Light light = UnpackLight(lightId);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
