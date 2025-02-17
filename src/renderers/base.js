import TextureBuffer from './textureBuffer';
// Matrix math!!!
import { vec3, vec4, mat4} from "gl-matrix";

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this.nearWidth = 0;
    this.nearHeight = 0;
    this.farWidth = 0;
    this.farHeight = 0;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    let t_fov = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
    this.nearHeight = 2 * camera.near * t_fov;
    this.nearWidth = this.nearHeight * camera.aspect;

    this.farHeight = 2 * camera.far * t_fov;
    this.farWidth = this.farHeight * camera.aspect;

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }
    for(let lightId = 0; lightId < scene.lights.length; lightId++){
      let sliceBounds = this.calculateSliceBounds(scene, lightId, this.nearWidth, this.nearHeight, this.farWidth, this.farHeight, camera.near, camera.far, viewMatrix);
      for(let x = sliceBounds.xMin; x <= sliceBounds.xMax; x++)
      {
        for(let y = sliceBounds.yMin; y <= sliceBounds.yMax; y++)
        {
          for(let z = sliceBounds.zMin; z <= sliceBounds.zMax; z++)
          {
              let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

             let numLightsIndex = this._clusterTexture.bufferIndex(i, 0);
              let numLight = this._clusterTexture.buffer[numLightsIndex] + 1;

              if(numLight < (MAX_LIGHTS_PER_CLUSTER))
              {
                this._clusterTexture.buffer[numLightsIndex] = numLight;

                let nextLightIndex = this._clusterTexture.bufferIndex(i, Math.floor(numLight / 4)) + (numLight % 4);
                this._clusterTexture.buffer[nextLightIndex] = lightId;

              }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
  calculateSliceBounds(scene, lightId, near_width, near_height, far_width, far_height, nearClip, farClip, viewMatrix)
  {
    let sliceBoundary = { 'xMin' : 0, 'xMax' : 0, 'yMin' : 0, 'yMax' : 0, 'zMin' : 0, 'zMax' : 0};

    let lightRadius = scene.lights[lightId].radius;
    let lightPosWorld = scene.lights[lightId].position;
    let lightPosVec = vec4.fromValues(lightPosWorld[0], lightPosWorld[1], lightPosWorld[2], 1);
    vec4.transformMat4(lightPosVec, lightPosVec, viewMatrix);

    let lerp =((Math.abs( lightPosVec[2]) - nearClip) / (1.0 * farClip - nearClip));

    let sliceWidth = near_width + (far_width - near_width) * lerp;
    let sliceHeight = near_height + (far_height - near_height) * lerp;

    let bucketWidth = sliceWidth / this._xSlices;
    let bucketHeight = sliceHeight / this._ySlices;

    let bucketLeft = Math.floor((lightPosVec[0] - lightRadius + 0.5 * sliceWidth) / bucketWidth);
    let bucketTop = Math.floor((lightPosVec[1] + lightRadius + 0.5 * sliceHeight) / bucketHeight);

    let bucketRight = Math.floor((lightPosVec[0] + lightRadius + 0.5 * sliceWidth) / bucketWidth);
    let bucketBottom = Math.floor((lightPosVec[1] - lightRadius + 0.5 * sliceHeight) / bucketHeight);

    let bucketNear = Math.floor(((Math.abs(lightPosVec[2]) - nearClip - lightRadius) / (farClip - nearClip)) * this._zSlices);
    let bucketFar = Math.floor(((Math.abs(lightPosVec[2]) - nearClip + lightRadius) / (farClip - nearClip)) * this._zSlices);


    sliceBoundary.xMin = Math.max(0, Math.min(this._xSlices - 1, bucketLeft));
    sliceBoundary.xMax = Math.max(0, Math.min(this._xSlices - 1, bucketRight));

    sliceBoundary.yMin = Math.max(0, Math.min(this._ySlices - 1, bucketBottom));
    sliceBoundary.yMax = Math.max(0, Math.min(this._ySlices - 1, bucketTop));

    sliceBoundary.zMin = Math.max(0, Math.min(this._zSlices - 1, bucketNear));
    sliceBoundary.zMax = Math.max(0, Math.min(this._zSlices - 1, bucketFar));
    console.log(sliceBoundary);
    return sliceBoundary;
  }

}
