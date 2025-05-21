import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

let scene, camera, renderer;
let paintingData = [];
let controller, controller1; 
let raycaster;
let infoCard = null;
let infoVisible = false;
let closingInfoCard = false;
let inRoom = false;
let menuVisible = false;
let menuGroup = null;
let roomModel = null;
let catalogGroup = null;
let catalogVisible = false;
let currentCatalogPage = 0;
const catalogPageSize = 10;     
let catalogPageData = [];
let totalPaintings = 0;
let searchQuery = "";
let keyboardGroup = null;
let lastMenuButtonPressed = {
  left: false,
  right: false
};

const roomSelectors = [];
const paintingFrames = [];
const paintingLabels = [];

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  setupController();
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(light);

  renderer.setAnimationLoop(animate);
  showRoomSelection();
}

function setupController() {
  const controllerModelFactory = new XRControllerModelFactory();
  
  //right controller
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  raycaster = new THREE.Raycaster();

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);

  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  line.name = 'line';
  line.scale.z = 5;
  controller.add(line);

  const controllerGrip = renderer.xr.getControllerGrip(0);
  controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
  scene.add(controllerGrip);

  //left controller
  controller1 = renderer.xr.getController(1);
  controller1.addEventListener('select', onSelect);
  scene.add(controller1);

  const line1 = new THREE.Line(
    lineGeometry.clone(),
    new THREE.LineBasicMaterial({ color: 0x00ffcc })
  );
  line1.name = 'line';
  line1.scale.z = 5;
  controller1.add(line1);

  const controllerGrip1 = renderer.xr.getControllerGrip(1);
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
  scene.add(controllerGrip1);
}
  
function showRoomSelection() {
  const preview1 = createRoomPreview('Room 1', '/assets/room1.png', () => {
    clearRoomSelection();
    loadRoom(1);
});

  const preview2 = createRoomPreview('Room 2', '/assets/room2.png', () => {
    clearRoomSelection();
    loadRoom(2);
});

  const label1 = createTextLabel('Room 1 (Minimalistic Room)');
  label1.position.set(-1.5, 1.2, -2.99);
  label1.userData.onClick = () => {
  clearRoomSelection();
  loadRoom(1);
};

const label2 = createTextLabel('Room 2 (Classic Room)');
  label2.position.set(1.5, 1.2, -2.99);
  label2.userData.onClick = () => {
  clearRoomSelection();
  loadRoom(2);
};

  const roomTitleLabel = createTextLabel('Select a Room', 2.5, 0.4, 'bold 60px Georgia');
  roomTitleLabel.position.set(0.15, 2.5, -3);
  

  preview1.position.set(-1.5, 1.6, -3);
  preview2.position.set(1.5, 1.6, -3);
  label1.position.set(-1.5, 1.2, -2.95);
  label2.position.set(1.5, 1.2, -2.95);

  scene.add(preview1, preview2, label1, label2, roomTitleLabel);

  roomSelectors.push(preview1, preview2, label1, label2, roomTitleLabel);
}

function createRoomPreview(label, imageURL, onClick){
  const texture = new THREE.TextureLoader().load(imageURL);
  const material = new THREE.MeshBasicMaterial({ 
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: true,
   });

  const geometry = new THREE.PlaneGeometry(2, 1.2);
  const panel = new THREE.Mesh(geometry, material);

  panel.userData.isRoomSelector = true;
  panel.userData.onClick = onClick;
  panel.name = label;

  return panel;
}

function clearRoomSelection() {
  roomSelectors.forEach(obj => scene.remove(obj));
  roomSelectors.length = 0;
}

function clearRoom() {
  paintingFrames.forEach(f => scene.remove(f));
  paintingFrames.length = 0;

  if (menuGroup) {
    scene.remove(menuGroup);
    menuGroup = null;
  }

  if (roomModel) {
    scene.remove(roomModel);
    roomModel = null;
  }

  infoCard && scene.remove(infoCard);
  infoCard = null;
  infoVisible = false;

  paintingFrames.forEach(frame => scene.remove(frame));
  paintingFrames.length = 0;

  paintingLabels.forEach(label => scene.remove(label));
  paintingLabels.length = 0;

}


function loadRoom(roomNumber) {
  const modelPath = roomNumber === 1 ? 'assets/Room1.glb' : 'assets/Room2.glb';
  const loader = new GLTFLoader();

  loader.load(modelPath, (gltf) => {
    roomModel = gltf.scene;
    scene.add(roomModel);
    fetchPaintings(roomNumber);
  }, undefined, (err) => {
    console.error('Error loading room:', err);
  });

  inRoom = true;
}

function createTextLabel(text, width = 1.8, height = 0.3, font = '30px Arial') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = font;
  ctx.fillText(text, 20, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(width, height);

  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

async function fetchPaintings() {
  try{
    const res = await fetch('https://vr-museum-backend-c601.onrender.com/paintings');
    console.log('painting data', paintingData);
    const result = await res.json();
    paintingData = result.data;
    console.log('Painting loaded', paintingData);
    displayPaintings();
  } catch (err) {
    console.error('Failed to get painintgs', err);
  }
}

async function fetchCatalogPage(page = 1) {
  try {
    const res = await fetch(`https://vr-museum-backend-c601.onrender.com/paintings?page=${page}&limit=${catalogPageSize}`);
    const result = await res.json();
    console.log("Fetched catalog data:", result);

    catalogPageData = result.data || result;
    totalPaintings = result.total || result.length;
    currentCatalogPage = page - 1;
    showCatalog();
  } catch (err) {
    console.error('Failed to load catalog page', err);
  }
}

async function fetchFilteredPaintings({ title = "", artist = "", year = "" }) {
  try {
    const params = new URLSearchParams();
    if (title) params.append("title", title);
    if (artist) params.append("artist", artist);
    if (year) params.append("year", year);

    const res = await fetch(`https://vr-museum-backend-c601.onrender.com/search?${params.toString()}`);
    const result = await res.json();

    catalogPageData = result;
    totalPaintings = result.length;
    currentCatalogPage = 0;
    showCatalog();
  } catch (err) {
    console.error('Search failed:', err);
  }
}


function handleEnterKey() {
  const query = searchQuery.trim();
  if (!query) {
    fetchCatalogPage(1);
  } else {
    fetchFilteredPaintings({ title: query }); 
  }

  scene.remove(keyboardGroup);
  keyboardGroup = null;
}



function displayPaintings(){
    const startX = -2;
    const spacing = 1.2;
    const wallZ = -4.75;     
    const height = 1.6;  

  paintingData.slice(0, 1).forEach((painting, index) => {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.2, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );

    const xPos = startX + index * spacing;
    frame.position.set(xPos, height, wallZ);
    frame.lookAt(new THREE.Vector3(xPos, height, 0));
    frame.userData = painting;

    scene.add(frame);
    paintingFrames.push(frame);
  });

}

function onSelect(event){
  const thisController = event.target;

  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(thisController.matrixWorld);

  raycaster.ray.origin.setFromMatrixPosition(thisController.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();

  
  console.log("onSelect triggered");

  //Room Selectors
  if (roomSelectors && roomSelectors.length > 0) {
  const roomIntersects = raycaster.intersectObjects(roomSelectors, true);
  
  if (roomIntersects.length > 0) {
    const selected = roomIntersects[0].object;
    if (selected.userData && selected.userData.onClick) {
      console.log("Room selected:", selected.name || "Unnamed panel");
      selected.userData.onClick();
      return;
      }
    }
  }

  //Menu options
  if (menuGroup) {
    const menuIntersects = raycaster.intersectObjects(menuGroup.children, true);
    if (menuIntersects.length > 0) {
      const selected = menuIntersects[0].object;
      if (selected.userData?.onClick) {
        selected.userData.onClick();
        return;
      }
    }
  }

  //Cataloge options
  if (catalogGroup && catalogGroup.children && catalogGroup.children.length > 0) {
  const catalogIntersects = raycaster.intersectObjects(catalogGroup.children, true);
  if (catalogIntersects.length > 0) {
    const selected = catalogIntersects[0].object;
    if (selected.userData?.onClick) {
      selected.userData.onClick();
      return;
    }
  }
}

  //Keyboard selection
  if (keyboardGroup) {
  const keyIntersects = raycaster.intersectObjects(keyboardGroup.children, true);
  if (keyIntersects.length > 0) {
    const selected = keyIntersects[0].object;
    if (selected.userData?.onClick) {
      selected.userData.onClick();
      return;
    }
  }
}


  //InfoCard
  if (infoVisible && infoCard && !closingInfoCard) {
      closingInfoCard = true;
      infoCard.userData.opening = false;
      infoCard.userData.progress = 1;
      return;
    }

  if (infoVisible || !controller) return;

  const intersects = raycaster.intersectObjects(paintingFrames, true);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);

  const debugRay = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(),        
  5,                           
  0xffff00                     
  );
  thisController.add(debugRay);


  if (intersects.length > 0) {
    const selected = intersects[0].object;
    const data = selected.userData;

    const roomIntersects = raycaster.intersectObjects(roomSelectors);

    if (roomIntersects.length > 0) {
     const selected = roomIntersects[0].object;
    if (selected.userData.onClick) {
    selected.userData.onClick();
    return;
      }
    }

    infoCard = createInfoCard(data);
    infoCard.material.transparent = true;
    infoCard.material.opacity = 0;

    const rightOffset = new THREE.Vector3(2, 0, 0);
    selected.updateMatrixWorld();
    const worldRight = rightOffset.applyMatrix4(selected.matrixWorld.clone().extractRotation(selected.matrixWorld));
    const finalCardPos = selected.position.clone().add(worldRight).add(new THREE.Vector3(0, 0, 0));


    infoCard.userData = {
    mesh: infoCard,
    startPos: selected.position.clone(),
    endPos: finalCardPos,
    progress: 0,
    opening: true
    }

    infoCard.position.copy(selected.position); 
    infoCard.userData.startPos = selected.position.clone();
    infoCard.userData.endPos = finalCardPos;

    scene.add(infoCard);
    infoVisible = true;

  }
}

function showMenu(){
    menuGroup = new THREE.Group();
    menuVisible = true;

  const options = [
    { label: 'Catalog', action: () =>{
        hideMenu();
        currentCatalogPage = 0;
        fetchCatalogPage(currentCatalogPage + 1); 
    }
     },
    { label: 'Sound', action: () => console.log('Sound pressed') },
    { label: 'Change Room', action: () => {
      clearRoom();
      showRoomSelection();
      inRoom = false;
      menuVisible = false;
    }},
  ];

  options.forEach((opt, i) => {
    const button = createTextLabel(opt.label, 1.5, 0.4);
    button.position.set(0, 1.6 - i * 0.6, -2);
    button.lookAt(camera.position);
    button.userData.isMenuOption = true;
    button.userData.onClick = opt.action;
    menuGroup.add(button);
  });

  scene.add(menuGroup);
}

function showCatalog() {
  if (catalogGroup) scene.remove(catalogGroup)
  catalogGroup = new THREE.Group();
  catalogVisible = true;

  const startY = 2;
  const rowHeight = 0.4;
  
  const pageData = catalogPageData;

  // Headers
  const headerY = startY + 0.5;
  const titleHeader = createCatalogHeaderCell('Title', -2.2, headerY, 2.8, 800);
  const artistHeader = createCatalogHeaderCell('Artist', 0, headerY);
  const yearHeader = createCatalogHeaderCell('Year', 1.6, headerY);
  catalogGroup.add(titleHeader, artistHeader, yearHeader);

  //Search bar
  const searchBar = createTextInputBox("Search...");
  searchBar.position.set(0, headerY + 0.6, -2.5);
  searchBar.position.z = 0.01;

  searchBar.userData.isSearchInput = true;
  searchBar.userData.onClick = () => {
    showVirtualKeyboard(searchBar);
  };

  catalogGroup.add(searchBar);

  // Data rows
  pageData.forEach((painting, i) => {
    const y = startY - i * rowHeight;

    const title = createCatalogCell(painting.title || 'title', -2.2, y, 2.8, 800);
    const artist = createCatalogCell(painting.artist || 'artist', 0, y, 1.6);
    const year = createCatalogCell(painting.year || 'year', 1.6, y, 1.6);

    const cells = [title, artist, year];

    cells.forEach(cell => {
      cell.userData.onClick = () => {
        console.log("Painting selected from catalog:", painting.title);
        updateWallFrame(painting);
        hideCatalog();
      };
      catalogGroup.add(cell);
    });
  });

  // Navigation buttons
  const rowCount = pageData.length;
  const lastRowY = startY - (rowCount - 1) * rowHeight;
  const buttonY = lastRowY - 0.6;
  const prevButton = createTextLabel('⬅️ Prev', 1.2, 0.4);
  prevButton.position.set(-1.5, buttonY, 0);
  prevButton.position.z = 0.01;
  prevButton.userData.onClick = () => {
    if (currentCatalogPage > 0) {
      currentCatalogPage--;
      fetchCatalogPage(currentCatalogPage + 1); 
    }
  };

  const nextButton = createTextLabel('Next ➡️', 1.2, 0.4);
  nextButton.position.set(1.5, buttonY, 0);
  nextButton.position.z = 0.01;
  nextButton.userData.onClick = () => {
    const totalPages = Math.ceil(totalPaintings / catalogPageSize);
    if (currentCatalogPage + 1 < totalPages) {
    currentCatalogPage++;
    fetchCatalogPage(currentCatalogPage + 1);
  }
  };

  catalogGroup.add(prevButton, nextButton);

  catalogGroup.scale.set(0.5, 0.5, 0.5);
  catalogGroup.position.set(0, 1.8, -3);
  catalogGroup.lookAt(camera.position);
  const totalPages = Math.ceil(totalPaintings / catalogPageSize);
  const currentPageDisplay = createTextLabel(
    `Page ${currentCatalogPage + 1} of ${totalPages}`,
    2, 0.4
  );

  currentPageDisplay.position.set(0, buttonY, 0);
  currentPageDisplay.position.z = 0.01;
  currentPageDisplay.scale.set(0.9, 0.9, 0.9);
  catalogGroup.add(currentPageDisplay);

    scene.add(catalogGroup);
}

function updateWallFrame(painting) {
  paintingFrames.forEach(f => scene.remove(f));
  paintingLabels.forEach(l => scene.remove(l));
  paintingFrames.length = 0;
  paintingLabels.length = 0;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );

  const wallZ = -4.75;
  const height = 1.6;
  frame.position.set(0, height, wallZ);
  frame.lookAt(new THREE.Vector3(0, height, 0));
  frame.userData = painting;

  scene.add(frame);
  paintingFrames.push(frame);
}

function updateSearchInputBox(inputBox, text) {
  const canvas = inputBox.material.map.image;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(text || "Search...", 20, 80);

  inputBox.material.map.needsUpdate = true;
}

function hideCatalog() {
  if (catalogGroup) {
    scene.remove(catalogGroup);
    catalogGroup = null;
  }
  catalogVisible = false;

  if (keyboardGroup) {
    scene.remove(keyboardGroup);
    keyboardGroup = null;
  }

  searchQuery = "";
}

function createCatalogCell(text, x, y, width) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '45px Arial';
  ctx.fillText(text.slice(0, 40), 10, 80); // limit to 40 chars

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(width, 0.4);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  return mesh;
}

function createCatalogHeaderCell(text, x, y, width = 1.4, canvasWidth = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 60px Arial';
  ctx.fillText(text, 20, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(width, 0.4);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, 0);
  return mesh;
}

function createTextInputBox(placeholder = "") {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(placeholder, 20, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(3, 0.4);
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function hideMenu() {
  if (menuGroup) {
    scene.remove(menuGroup);
    menuGroup = null;
  }
  menuVisible = false;
}

function createInfoCard(data) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '24px Arial';
  ctx.fillText(`Title: ${data.title}`, 20, 60);
  ctx.fillText(`Artist: ${data.artist}`, 20, 110);
  ctx.fillText(`Year: ${data.year}`, 20, 160);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(3, 0.9);
  return new THREE.Mesh(geometry, material);
}

function animate() {
  const session = renderer.xr.getSession();

  if (session) {
    for (const source of session.inputSources) {
      if (!source.gamepad || !source.handedness) continue;

      const buttons = source.gamepad.buttons;
      const hand = source.handedness;
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].pressed) {
        
          console.log(`${hand} hand: Button ${i} pressed`);
        }
      }

  
      const isPressed = buttons[5]?.pressed;

     if (inRoom) {
      if (isPressed && !lastMenuButtonPressed[hand]) {
        if(catalogVisible) {
          hideCatalog();
          showMenu();
        } else if (menuVisible) {
          console.log("Menu button pressed: Hiding menu");
          hideMenu();
        } else {
          console.log("Menu button pressed: Showing menu");
          showMenu();
        }
      }

    lastMenuButtonPressed[hand] = isPressed;
  }
  }
  }

  window.addEventListener('keydown', (e) => {
  if (e.key === 'm' && inRoom && !menuVisible) {
    console.log('M key triggered menu');
    showMenu();
  }
});

  if (controller && raycaster) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  }

  if (infoCard && infoCard.userData) {
    const { mesh, startPos, endPos, opening } = infoCard.userData;

    if (opening && infoCard.userData.progress < 1) {
      infoCard.userData.progress += 0.01;
      const t = infoCard.userData.progress;
      infoCard.position.lerpVectors(startPos, endPos, t);
      mesh.material.opacity = t;
    }

    if (closingInfoCard && infoCard.userData.progress > 0) {
      infoCard.userData.progress -= 0.01;
      const t = infoCard.userData.progress;
      infoCard.position.lerpVectors(endPos, startPos,1 - t);
      mesh.material.opacity = t;

      if (t <= 0) {
        scene.remove(infoCard);
        infoCard = null;
        infoVisible = false;
        closingInfoCard = false;
      }
    }
  }

    renderer.render(scene, camera);
}

function createKeyLabel(char, width = 0.4, height = 0.4) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(30, 30, 30, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 100px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const geometry = new THREE.PlaneGeometry(width, height);
  return new THREE.Mesh(geometry, material);
}

function showVirtualKeyboard(targetInputBox) {
  if (keyboardGroup) scene.remove(keyboardGroup);
  keyboardGroup = new THREE.Group();

  const keys = [
    'Q','W','E','R','T','Y','U','I','O','P',
    'A','S','D','F','G','H','J','K','L',
    'Z','X','C','V','B','N','M',
    '⌫','␣','↵'
  ];

  const keySize = 0.4;
  const spacing = 0.5;
  let row = 0, col = 0;

  keys.forEach((char, i) => {
    if ((i === 10) || (i === 19)) {
      row++;
      col = 0;
    }

    const key = createKeyLabel(char, keySize, 0.4);
    key.position.set((col - 5) * spacing, 0.8 - row * spacing, 0);
    key.userData.char = char;
    key.userData.onClick = () => {
      if (char === '⌫') {
        searchQuery = searchQuery.slice(0, -1);
      } else if (char === '␣') {
        searchQuery += ' ';
      } else if (char === '↵') {
        handleEnterKey();
        return;
      } else {
        searchQuery += char;
      }

      updateSearchInputBox(targetInputBox, searchQuery);
    };

    keyboardGroup.add(key);
    col++;
  });

  

  keyboardGroup.scale.set(0.5, 0.5, 0.5);
  keyboardGroup.position.set(2, 0.6, -2);
  keyboardGroup.lookAt(camera.position);
  scene.add(keyboardGroup);
}
