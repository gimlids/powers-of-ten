import superagent from 'superagent';
import {gunzip} from 'zlib';

import ShardedMapView from 'shardedmapview';

var scrollScreenCount = 20;
var spacer = document.querySelector('.spacer');
spacer.style.height = `${scrollScreenCount*100}vh`;
var maxZoom = 70;
var minZoom = -69;
// var minZoom = 2;
// var center = {x: 176, y: 48};
var center = {"x":"128.0016141500943428448072593252413229423969638627691528974582234357628736503442433126402991383946653653658571601445669123154923965573998471437018910682341037293499355108706628977960574481437612486658","y":"128.00195132018363418487352763163562855601469064111825050735847960634477794103218654962983385885214726693906899946292441207098880544632960588659986178493271958960278199345308309633137493641369036839327"};

const urlForGlobalTileCoord = globalTileCoord => (
  `tiles/${globalTileCoord.z}/${globalTileCoord.y}/${globalTileCoord.x}.jpg`
);


let preload = {};
// let preload = Object.assign(
//   require('./preload/zoom-1.json'),
//   require('./preload/zoom-2.json')
// );


// superagent.get('preload/all.json').end((err, res) => {
//   console.log({res});
//   Object.assign(preload, res.body);
//   console.log(`preloaded ${Object.keys(res.body).length} tiles`);
// });


window.olView = new ol.View({
  zoom: minZoom,
  minZoom: 0,
  maxZoom: 32
});
window.map = new ol.Map({
  renderer: 'canvas',
  interactions: ol.interaction.defaults().extend([
    new ol.interaction.DragRotateAndZoom()
  ]),
  target: 'map',
  logo: false,
  controls: [],
  view: olView,
  loadTilesWhileAnimating: true,
  loadTilesWhileInteracting: true
});

map.on('pointerup', function(e) {
  console.log(e.coordinate);
  console.log(JSON.stringify(globalView.activeShardCoordToGlobalCoord({
    x: e.coordinate[0],
    y: e.coordinate[1]
  })));
});
map.on('zoomend', map, function() {
  var zoomInfo = 'Zoom level=' + map.getZoom() + '/' + (map.numZoomLevels + 1);
  console.log(zoomInfo);
});
map.on('zoom', function(e) {
  console.log(e);
});

const viewExtent = olView.getProjection().getExtent();

let shardLayers = {};

const createShardLayer = shard => {
  return new ol.layer.Tile({
    source: new ol.source.XYZ({
      tileUrlFunction: function(tileCoord, pixelRatio, projection) {
        const localTileCoord = {
          z: tileCoord[0],
          y: -1-tileCoord[2],
          x: tileCoord[1]
        };
        const globalTileCoord = shard.localTileCoordToGlobalTileCoord(localTileCoord);
        // console.info({globalTileCoord});
        const tile = ShardedMapView.Tile({
          zoom: globalTileCoord.z,
          row: globalTileCoord.y,
          column: globalTileCoord.x
        });
        if(tile.key() in preload) {
          // console.info(`${tile.key()} is in preload. using data URL`);
          return preload[tile.key()];
        }
        // else {
        //   return 'gray_test_tile.png';
        // }
        else {
          // console.info(tile.key());
          const url = urlForGlobalTileCoord(globalTileCoord);
          // console.log(`${tile.key()} is NOT in preload. loading from remote ${url}`);
          return url;
        }
        
      },
      // url: 'tiles/{z}/{y}/{x}.jpg',
      tilePixelRatio: 1,
      // tileSize: [256, 256],
      tileSize: [512, 512],
      // tileSize: [1024, 1024],
      minZoom: minZoom,
      maxZoom: maxZoom,
      wrapX: false
    })
  });
};

let activeShardLayer;
var globalView = ShardedMapView({
  shardExtent: ShardedMapView.Bounds({
    left: viewExtent[0],
    bottom: viewExtent[1],
    right: viewExtent[2],
    top: viewExtent[3]
  }),
  initialView: {
    zoom: minZoom,
    center: center
  },
  setActiveShard: shard => {
    shard.key()
    if(activeShardLayer) {
      //map.removeLayer(activeShardLayer);
      activeShardLayer.setVisible(false);
    }
    if(!shardLayers[shard.key()]) {
      shardLayers[shard.key()] = createShardLayer(shard);
      map.addLayer(shardLayers[shard.key()]);
    }
    activeShardLayer = shardLayers[shard.key()];
    activeShardLayer.setVisible(true);
    
  },
  setActiveShardView: view => {
    olView.setZoom(view.zoom);
    olView.setCenter([view.center.x, view.center.y]);
    // console.info('set local view', view);
  }
});

var last_known_scroll_progress = 0;
var ticking = false;

var spacer = document.querySelector('.spacer');
var mapEl = document.querySelector('.map');
function getScrollProgress() {
    return Math.abs(spacer.getBoundingClientRect().top / (scrollScreenCount * mapEl.getBoundingClientRect().height * (scrollScreenCount-1)/scrollScreenCount));
}


document.querySelector('.scroller').addEventListener('click', e => {
  console.log(globalView.zoom());
});


const replaceHash = value => {
  const url = window.location.href.substring(0, window.location.href.indexOf('#'));
  history.replaceState(null, '', `${url}#${value}`);
};
const getHash = () => {
  const hashIndex = window.location.href.indexOf('#');
  if(hashIndex > -1) {
    return window.location.href.substring(hashIndex+1);
  }
  else {
    return null;
  }
};

const ease = 0;
let zoomTarget;
const doEase = () => {
  globalView.setView({
    zoom: zoomTarget * (1-ease) + globalView.zoom() * ease,
    center: center
  });
  if(Math.abs(zoomTarget - globalView.zoom()) > 0.01) {
    requestAnimationFrame(doEase);
  }
};

function doSomething(scroll_percent) {
  zoomTarget = minZoom + scroll_percent * (maxZoom - minZoom);
  doEase();
  // replaceHash(zoomTarget);
}

document.querySelector('.scroller').addEventListener('scroll', function(e) {
  last_known_scroll_progress = getScrollProgress();
  if (!ticking) {
    window.requestAnimationFrame(function() {
      doSomething(last_known_scroll_progress);
      ticking = false;
    });
  }
  ticking = true;
});

// if(getHash().length) {
//   globalView.setView({
//     zoom: +getHash(),
//     center: center
//   });
// }
