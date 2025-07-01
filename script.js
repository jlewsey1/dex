// Import Firebase from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, getDocs, doc,
    updateDoc, addDoc, deleteDoc, onSnapshot
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, getRedirectResult} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
  


// Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDovQzJx4s_jMpd5eaZNXB1k_30hzZ4p9Y",
    authDomain: "card-tracker-be910.firebaseapp.com",
    projectId: "card-tracker-be910",
    storageBucket: "card-tracker-be910.firebasestorage.app",
    messagingSenderId: "80730645121",
    appId: "1:80730645121:web:64b003389a727ecf226380",
    measurementId: "G-XNM7MG08J8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM elements
const cardList = document.getElementById("cardList");
const sortOptions = document.getElementById("sortOptions");
const filterOptions = document.getElementById("filterOptions");

let cards = [];
let editingId = null;  // stores the id of card currently being edited (null if none)

// Fetch cards from Firestore
async function fetchCards() {
  console.log("Fetching cards...");
  const querySnapshot = await getDocs(collection(db, "cards"));
  cards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderCards(cards);
}

let activeSet = null; // null = all sets

// Render cards
function renderCards(dataToRender = cards) {
    let filtered = [...dataToRender];
  
    // ✅ Filter by active tab (set)
    if (activeSet !== null) {
      filtered = filtered.filter(card => card.set === activeSet);
    }
  
    // ✅ Apply dropdown filters
    const sort = sortOptions.value;
    const filter = filterOptions.value;
  
    if (filter === "owned") filtered = filtered.filter(card => card.owned);
    else if (filter === "unowned") filtered = filtered.filter(card => !card.owned);
  
    // ✅ Apply sorting
    if (sort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "dex") {
      filtered.sort((a, b) => a.dexNumber - b.dexNumber);
    } else if (sort === "set") {
      if (activeSet !== null) {
        // 🔠 Sort by alphanumeric setNumber within the set
        filtered.sort((a, b) => a.setNumber.localeCompare(b.setNumber, undefined, { numeric: true, sensitivity: 'base' }));
      } else {
        filtered.sort((a, b) => a.set.localeCompare(b.set));
      }
    } else if (sort === "price") {
        filtered.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
    } else if (sort === "price-desc") {
        filtered.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
    }
      
  
    // ✅ Then render as usual...
    cardList.innerHTML = "";
  
    filtered.forEach(card => {
        const li = document.createElement("li");
    
        if (card.id === editingId) {
          // Render edit form for this card
          li.innerHTML = `
            <form class="edit-form" data-id="${card.id}">
              <input name="name" value="${card.name}" required />
              <input name="dexNumber" type="number" value="${card.dexNumber}" required />
              <input name="set" value="${card.set}" required />
              <input name="setNumber" value="${card.setNumber}" />
              <input name="currentPrice" type="number" step="0.01" value="${card.currentPrice || 0}" />
              <label>
                <input name="owned" type="checkbox" ${card.owned ? "checked" : ""} />
                Owned
              </label>
              <button type="submit">Save</button>
              <button type="button" class="cancel-btn">Cancel</button>
            </form>
          `;
        } else {
          // Normal card display with edit/delete buttons
          li.innerHTML = `
          <label>
            <input type="checkbox" ${card.owned ? "checked" : ""} data-id="${card.id}">
            <strong class="card-name" data-set="${card.set}" data-setnumber="${card.setNumber}" style="cursor: pointer; color: blue;">
              ${card.name}
            </strong><br>
            ${card.dexNumber === 9999 ? "Trainer" : `Pokédex #${String(card.dexNumber).padStart(4, '0')}`}<br>
            Set: ${card.set}<br>
            Set ID: ${card.setNumber}<br>
            Current Price: $${card.currentPrice?.toFixed(2) || "0.00"}
          </label>
          <button class="edit-btn" data-id="${card.id}">Edit</button>
          <button class="delete-btn" data-id="${card.id}">Delete</button>
          <button class="update-price-btn" data-id="${card.id}" data-setnumber="${card.setNumber}">Update Price</button>
        `;        
        }
        cardList.appendChild(li);
      });

      // Attach listeners AFTER rendering
    
      // Checkbox owned toggle
      document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
        if (checkbox.name !== "owned") {  // skip owned checkbox in edit forms
          checkbox.addEventListener("change", async (e) => {
            const cardId = e.target.dataset.id;
            const newStatus = e.target.checked;
            const cardRef = doc(db, "cards", cardId);
            await updateDoc(cardRef, { owned: newStatus });
    
            cards.find(c => c.id === cardId).owned = newStatus;
            renderCards(cards);
          });
        }
      });


      // open modal
      document.querySelectorAll(".card-name").forEach(el => {
        el.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation(); // Prevents toggling the checkbox
      
          const setNumber = e.target.dataset.setnumber;
      
          const imageUrl = await fetchCardImageFromTCG(setNumber);
      
          const modal = document.getElementById("cardModal");
          const modalContent = document.getElementById("modalContent");
          modal.style.display = "flex";
          modal.classList.add("show");
          modalContent.innerHTML = imageUrl
            ? `<img src="${imageUrl}" alt="Card Image" style="width:100%; max-height:85vh; object-fit:contain;">`
            : `<p>No image found for ${setNumber}</p>`;
        });
      });
      
    
      // Edit buttons: just set editingId and re-render
      document.querySelectorAll(".edit-btn").forEach(button => {
        button.addEventListener("click", (e) => {
          editingId = e.target.dataset.id;
          renderCards(cards);
        });
      });
    
      // Delete buttons
      document.querySelectorAll(".delete-btn").forEach(button => {
        button.addEventListener("click", async (e) => {
          const cardId = e.target.dataset.id;
          if (!confirm("Are you sure you want to delete this card?")) return;
    
          await deleteDoc(doc(db, "cards", cardId));
          cards = cards.filter(c => c.id !== cardId);
          renderCards(cards);
        });
      });
      
      // Update price button
    document.querySelectorAll(".update-price-btn").forEach(button => {
        button.addEventListener("click", async (e) => {
        const cardId = e.target.dataset.id;
        const setNumber = e.target.dataset.setnumber;
    
        try {
            const price = await fetchPriceFromPokemonTCG(setNumber);
            if (price !== null) {
            await updateCardPrice(cardId, price);
            alert(`✅ Price updated to $${price.toFixed(2)}`);
            } else {
            alert("❌ Price not found.");
            }
        } catch (err) {
            console.error("Error updating price:", err);
            alert("⚠️ Failed to update price.");
        }
        });
    });
  
    
      // Edit form submit
      document.querySelectorAll(".edit-form").forEach(form => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const cardId = form.dataset.id;
    
          const formData = new FormData(form);
          const updatedCard = {
            name: formData.get("name"),
            dexNumber: parseInt(formData.get("dexNumber")),
            set: formData.get("set"),
            setNumber: formData.get("setNumber"),
            currentPrice: parseFloat(formData.get("currentPrice")) || 0,
            owned: formData.get("owned") === "on",
          };
    
          const cardRef = doc(db, "cards", cardId);
          await updateDoc(cardRef, updatedCard);
    
          // Update local data
          const cardIndex = cards.findIndex(c => c.id === cardId);
          cards[cardIndex] = { id: cardId, ...updatedCard };
    
          editingId = null;
          renderCards(cards);
        });
      });
    
      // Cancel button (just cancel editing)
      document.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          editingId = null;
          renderCards(cards);
        });
      });


    renderSetTabs(cards);
    
    updateOwnedCount(filtered);
    updateTotalCardPrice(filtered);
}

  
  

// Event listeners
sortOptions.addEventListener("change", () => renderCards(cards));
filterOptions.addEventListener("change", () => renderCards(cards));

// Fetch on page load after login
// fetchCards();

document.getElementById('searchInput').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    const searched = cards.filter(c => c.name.toLowerCase().includes(term));
    renderCards(searched); // now passes search results in
  });
  
// add card
document.getElementById("addCardForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const newCard = {
      name: document.getElementById("cardName").value,
      dexNumber: parseInt(document.getElementById("dexNumber").value),
      set: document.getElementById("set").value,
      setNumber: document.getElementById("setNumber").value,
      currentPrice: parseFloat(document.getElementById("currentPrice").value) || 0,
      owned: document.getElementById("owned").checked,
  };

  await addDoc(collection(db, "cards"), newCard);
  await fetchCards(); // Refresh the list
  e.target.reset();   // Clear the form
});

// add card from csv
document.getElementById("csvInput").addEventListener("change", async (e) => {
    console.log("File selected!");
  
    const file = e.target.files[0];
    if (!file) return console.warn("No file selected.");
  
    const text = await file.text();
    console.log("File contents:", text);
  
    const rows = text.trim().split("\n");
    const headers = rows[0].split(",").map(h => h.trim());
  
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(",").map(v => v.trim());
      const card = {};
  
      headers.forEach((header, idx) => {
        let val = values[idx];
        if (header === "dexNumber") card[header] = parseInt(val);
        else if (header === "currentPrice") card[header] = parseFloat(val);
        else if (header === "owned") card[header] = val.toLowerCase() === "true";
        else card[header] = val;
      });
  
      console.log("Adding card to Firestore:", card);
      await addDoc(collection(db, "cards"), card);
    }
  
    alert("Cards imported successfully!");
    fetchCards(); // Refresh list
  });


// TCGPLAYER USAGE
const modal = document.getElementById("cardModal");


// Close modal when clicking the "X"
document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("cardModal").style.display = "none";
  });
  
  // Close modal when clicking outside the content
  document.getElementById("cardModal").addEventListener("click", (e) => {
    if (e.target.id === "cardModal") {
      document.getElementById("cardModal").style.display = "none";
    }
  });


  
  

  async function fetchCardImageFromTCG(setNumber) {
    const query = `id:${setNumber}`;
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}`;
  
    const response = await fetch(url);
    const data = await response.json();
  
    if (data?.data?.length > 0) {
      return data.data[0].images.large || null;
    }
    return null;
  }
  
  
  async function updateCardPrice(cardId, newPrice) {
    const cardRef = doc(db, "cards", cardId);
    await updateDoc(cardRef, { currentPrice: newPrice });
  
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      cards[cardIndex].currentPrice = newPrice;
      renderCards(cards);
    }
  }

  document.getElementById("bulkUpdatePricesBtn").addEventListener("click", async () => {
    if (!confirm("This will update prices for ALL cards in the current view. Continue?")) return;
  
    const bulkBtn = document.getElementById("bulkUpdatePricesBtn");
    bulkBtn.disabled = true;
    bulkBtn.textContent = "Updating Prices...";
  
    // Filter cards based on activeSet: if null, update all cards; else only cards from activeSet
    const cardsToUpdate = activeSet 
      ? cards.filter(card => card.set === activeSet) 
      : cards;
  
    let updatedCount = 0;
    let failedCount = 0;
  
    for (const card of cardsToUpdate) {
      try {
        const fullCardId = card.setNumber; // e.g., 'sv3-112'
  
        const price = await fetchPriceFromPokemonTCG(fullCardId);
        if (price !== null) {
          await updateCardPrice(card.id, price);
          updatedCount++;
        } else {
          failedCount++;
          console.warn(`No price found for ${card.name} (${card.setNumber})`);
        }
      } catch (err) {
        console.error(`❌ Error updating ${card.name}:`, err);
        failedCount++;
      }
  
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  
    bulkBtn.disabled = false;
    bulkBtn.textContent = "Update All Prices";
  
    alert(`✅ Prices updated for ${updatedCount} card(s).\n❌ Failed to update ${failedCount}.`);
  });
  

  
// update price button
async function fetchPriceFromPokemonTCG(cardId) {
    const url = `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(cardId)}`;
    console.log("Fetching card price from:", url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data?.data) {
        console.log("TCG API response:", data.data);
        return (
        data.data.tcgplayer?.prices?.holofoil?.market ||  // preferred price type
        data.data.tcgplayer?.prices?.normal?.market ||    // fallback
        null
        );
    }
    
    return null;
    }

function renderSetTabs() {
    const tabContainer = document.getElementById("setTabs");
    tabContainer.innerHTML = "";
    
    const sets = [
        "Base Set", "Jungle", "Fossil", "Base Set 2", "Team Rocket",
        "Gym Heroes", "Gym Challenge",
        "Neo Genesis", "Neo Discovery", "Neo Revelation", "Neo Destiny", 
        "Legendary Collection",
        "Expedition","Aquapolis", "Skyridge",
        "EX Ruby & Sapphire", "EX Sandstorm", "EX Dragon", "EX Team Magma vs Team Aqua", "EX Hidden Legends", "EX FireRed & LeafGreen",
        "EX Team Rocket Returns", "EX Deoxys", "EX Emerald", "EX Unseen Forces", "EX Delta Species", "EX Legend Maker", "EX Holon Phantoms",
        "EX Crystal Guardians", "EX Dragon Frontiers", "EX Power Keepers",
        "Diamond & Pearl", "Mysterious Treasures", "Secret Wonders", "Great Encounters", "Majestic Dawn", "Legends Awakened", "Stormfront",
        "Pop Promos",
        "Platinum", "Rising Rivals", "Supreme Victors", "Arceus", 
        "HeartGold & SoulSilver", "Unleashed", "Undaunted", "Triumphant",
        "Call of Legends",
        "Black & White", "Emerging Powers", "Noble Victories", "Next Destinies", "Dark Explorers", "Dragons Exalted", "Boundaries Crossed",
        "Plasma Storm", "Plasma Freeze", "Plasma Blast", "Legendary Treasures", "BW Radiant Collection",
        "XY Promos", "XY", "Flashfire", "Furious Fists", "Phantom Forces", "Primal Clash", "Double Crisis", "Roaring Skies", "Ancient Origins", 
        "BREAKthrough", "BREAKpoint", "Generations", "Fates Collide", "Steam Siege", "Evolutions", "Shiny Vault",
        "Sun & Moon", "Guardians Rising", "Burning Shadows", "Shining Legends", "Crimson Invasion", "Ultra Prism", "Forbidden Light",
        "Celestial Storm", "Dragon Majesty", "Lost Thunder", "Team Up", "Unbroken Bonds", "Unified Minds", "Hidden Fates", "Cosmic Eclipse",
        "SWSH Promos", "Sword & Shield", "Rebel Clash", "Darkness Ablaze", "Champion's Path", "Vivid Voltage", "Battle Styles", "Chilling Reign",
        "Evolving Skies", "Fusion Strike", "Brilliant Stars", "Brilliant Stars Trainer Gallery", "Astral Radiance", "Astral Radiance Trainer Gallery", 
        "Pokémon Go", "Lost Origin", "Lost Origin Trainer Gallery", "Silver Tempest", "Silver Tempest Trainer Gallery", "Crown Zenith", "Crown Zenith Galarian Gallery",
        "SV Promos", "Scarlet & Violet", "Paldea Evolved", "Obsidian Flames", "151", "Paradox Rift", "Paldean Fates", "Temporal Forces",
        "Twilight Masquerade", "Shrouded Fable", "Stellar Crown", "Surging Sparks", "Prismatic Evolutions", "Journey Together", "Destined Rivals",
        "Black Bolt", "White Flare"
    ];
    
    // Create a lookup map from lowercase set name to proper set name for display
    const setsMap = new Map();
    sets.forEach(setName => {
      setsMap.set(normalizeSetName(setName), setName);
    });    
    
    // Normalize sets in cards and get unique sets (lowercase normalized)
    const cardSetsLower = new Set(cards.map(card => normalizeSetName(card.set)));

    
    // Filter sets that exist in cards (by lowercase match)
    const filteredSets = sets.filter(setName => cardSetsLower.has(normalizeSetName(setName)));
    
    // Find any card sets not found in your master list (for debugging)
    const unmatchedSets = [...cardSetsLower].filter(set => !setsMap.has(set));
    if (unmatchedSets.length > 0) {
        console.warn("Warning: card sets not matched to master list:", unmatchedSets);
    }
    
    // Always add "All Sets" tab
    const allTab = document.createElement("button");
    allTab.textContent = "📚 All Sets";
    allTab.className = "tab-button";
    allTab.addEventListener("click", () => {
        activeSet = null;
        renderCards(cards);
        setActiveTab(null);
    });
    tabContainer.appendChild(allTab);
    
    // Add tabs for filtered sets, using proper capitalization from setsMap
    filteredSets.forEach(setName => {
        const tab = document.createElement("button");
        tab.textContent = setName; // setName is already proper case
        tab.className = "tab-button";
        tab.addEventListener("click", () => {
        activeSet = setName;
        renderCards(cards);
        setActiveTab(setName);
        });
        tabContainer.appendChild(tab);
    });
    
    // Highlight the active tab
    function setActiveTab(setName) {
        const tabs = tabContainer.querySelectorAll(".tab-button");
        tabs.forEach(tab => {
        tab.classList.toggle("active-tab", tab.textContent === setName || (setName === null && tab.textContent === "📚 All Sets"));
        });
    }
    
    setActiveTab(activeSet);
}
      
function normalizeSetName(setName) {
    if (!setName) return "";
  
    let name = setName.toLowerCase().trim();
  
    // Common aliases and fixes:
    const replacements = [
      // Fix spacing, typos, abbreviations, or alternate names
      { from: /^base set 2.*$/, to: "base set 2" },
      { from: /^team rocket returns$/, to: "ex team rocket returns" }, // example fix if some cards say "Team Rocket Returns" without EX prefix
      { from: /^ex ruby and sapphire$/, to: "ex ruby & sapphire" },
      { from: /^hgss$/, to: "heartgold & soulsilver" },
      { from: /^bw radiant collection$/, to: "bw radiant collection" }, // just to show pattern
      { from: /^sv promos$/, to: "sv promos" },
      { from: /^xy flashfire$/, to: "flashfire" },
      { from: /^ex hidden legends$/, to: "ex hidden legends" },
      { from: /^pop promos$/, to: "pop promos" },
      { from: /^brilliant stars trainer gallery$/, to: "brilliant stars trainer gallery" },
      { from: /^astral radiance trainer gallery$/, to: "astral radiance trainer gallery" },
      { from: /^lost origin trainer gallery$/, to: "lost origin trainer gallery" },
      { from: /^silver tempest trainer gallery$/, to: "silver tempest trainer gallery" },
      { from: /^crown zenith galarian gallery$/, to: "crown zenith galarian gallery" },
      { from: /^bandit ring$/, to: "ancient origins" },
      { from: /^pokemon center elite trainer box$/, to: "pokémon center elite trainer box" },
      { from: /^pokemon go$/, to: "pokémon go" },
      // Add more replacements as you discover variants
    ];
  
    for (const rep of replacements) {
      if (rep.from.test(name)) {
        return rep.to;
      }
    }
  
    return name;
  }  

function updateOwnedCount(cards) {
    const ownedCount = cards.filter(card => card.owned).length;
    const totalCount = cards.length;
    document.getElementById("ownedCountDisplay").textContent = `${ownedCount} / ${totalCount} owned`;
}
  
// Card * Slab * Box tabs

const tabs = document.querySelectorAll(".tab-btn");
const pages = {
  cardCollection: document.getElementById("cardCollection"),
  slabCollection: document.getElementById("slabCollection"),
  boxCollection: document.getElementById("boxCollection"),
};

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    // Remove active class from all tabs
    tabs.forEach(t => t.classList.remove("active"));

    // Hide all pages
    Object.values(pages).forEach(page => page.style.display = "none");

    // Activate clicked tab and show related page
    tab.classList.add("active");
    const target = tab.dataset.target;
    pages[target].style.display = "block";
  });
});

function updateTotalCardPrice(filteredCards) {
  const total = filteredCards.reduce((sum, card) => sum + (card.currentPrice || 0), 0);
  const display = document.getElementById("totalCardPriceDisplay");
  display.textContent = `Total Price: $${total.toFixed(2)}`;
}


// SLAB STUFF
let slabs = [];

async function loadSlabs() {
  const slabRef = collection(db, "slabs");
  const slabSnapshot = await getDocs(slabRef);
  slabs = slabSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderSlabs(slabs);
}


function renderSlabs(slabs) {
    const slabList = document.getElementById('slabList');
    const searchTerm = document.getElementById('searchSlabInput').value.toLowerCase();
    const sortOption = document.getElementById('sortSlabOptions').value;
    const filterOption = document.getElementById('filterSlabOptions').value;
  
    let filteredSlabs = slabs;

    // 1. Filter by active tab (set)
    if (activeSet) {
      filteredSlabs = filteredSlabs.filter(slab => normalizeSetName(slab.set) === normalizeSetName(activeSet));
    }
    
    // 2. Apply name search and ownership filter
    filteredSlabs = filteredSlabs.filter(slab =>
      slab.name.toLowerCase().includes(searchTerm) &&
      (filterOption === 'all' ||
       (filterOption === 'owned' && slab.owned) ||
       (filterOption === 'unowned' && !slab.owned))
    );
    
    // 3. Apply sorting
    if (sortOption === 'name') {
      filteredSlabs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === 'dex') {
      filteredSlabs.sort((a, b) => a.dexNumber - b.dexNumber);
    } else if (sortOption === 'set') {
      filteredSlabs.sort((a, b) => a.set.localeCompare(b.set));
    } else if (sortOption === 'price') {
      filteredSlabs.sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (sortOption === 'price-desc') {
      filteredSlabs.sort((a, b) => b.currentPrice - a.currentPrice);
    }
    
  
    slabList.innerHTML = '';
    let ownedCount = 0;
  
    filteredSlabs.forEach(slab => {
      if (slab.owned) ownedCount++;
  
      const li = document.createElement('li');
      li.classList.add('slab');

      if (slab.id === editingId) {
        // Render edit form for this slab
        li.innerHTML = `
          <form class="edit-slab-form" data-id="${slab.id}">
            <input name="name" value="${slab.name}" required />
            <input name="dexNumber" type="number" value="${slab.dexNumber}" required />
            <input name="set" value="${slab.set}" required />
            <input name="setNumber" value="${slab.setNumber}" />
            <input name="currentPrice" type="number" step="0.01" value="${slab.currentPrice || 0}" />
            <input name="imageUrl" value="${slab.imageUrl}" required />
            <label>
              <input name="owned" type="checkbox" ${slab.owned ? "checked" : ""} />
              Owned
            </label>
            <button type="submit">Save</button>
            <button type="button" class="cancel-slab-btn">Cancel</button>
          </form>
        `;
      } else {
        li.innerHTML = `
        <label>
          <input type="checkbox" ${slab.owned ? "checked" : ""} data-id="${slab.id}">
          <strong 
            class="slab-name" 
            data-slabname="${slab.name}" 
            data-imageurl="${slab.imageUrl}" 
            style="cursor: pointer; color: blue;">
            ${slab.name}
          </strong><br>
          ${slab.dexNumber === 9999 ? "Trainer" : `Pokédex #${String(slab.dexNumber).padStart(4, '0')}`}<br>
          Set: ${slab.set}<br>
          Set ID: ${slab.setNumber}<br>
          Current Price: $${slab.currentPrice?.toFixed(2) || "0.00"}
        </label>
        <button class="edit-slab-btn" data-id="${slab.id}">Edit</button>
        <button class="delete-slab-btn" data-id="${slab.id}">Delete</button>
      `;
      }

      li.addEventListener('click', () => openModal(slab));
      slabList.appendChild(li);
    });

    document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
      if (checkbox.name !== "owned") {  // skip owned checkbox in edit forms
        checkbox.addEventListener("change", async (e) => {
          const slabId = e.target.dataset.id;
          const newStatus = e.target.checked;
          const slabRef = doc(db, "slabs", slabId);
          await updateDoc(slabRef, { owned: newStatus });
  
          slabs.find(s => s.id === slabId).owned = newStatus;
          renderSlabs(slabs);
        });
      }
    });
  
    // modal part
    document.querySelectorAll(".slab-name").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
    
        const imageUrl = el.dataset.imageurl;
        const slabName = el.dataset.slabname;
    
        console.log("Opening modal with:", { imageUrl, slabName }); // <-- DEBUG HERE

        openSlabModal(imageUrl, slabName);
      });
    });
    
    // Edit buttons: just set editingId and re-render
    document.querySelectorAll(".edit-slab-btn").forEach(button => {
      button.addEventListener("click", (e) => {
        editingId = e.target.dataset.id;
        renderSlabs(slabs);
      });
    });
  
    // Delete buttons
    document.querySelectorAll(".delete-slab-btn").forEach(button => {
      button.addEventListener("click", async (e) => {
        const slabId = e.target.dataset.id;
        if (!confirm("Are you sure you want to delete this slab?")) return;
  
        await deleteDoc(doc(db, "slabs", slabId));
        slabs = slabs.filter(s => s.id !== slabId);
        renderSlabs(slabs);
      });
    });

    // Edit form submit
    document.querySelectorAll(".edit-slab-form").forEach(form => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const slabId = form.dataset.id;
  
        const formData = new FormData(form);
        const updatedSlab = {
          name: formData.get("name"),
          dexNumber: parseInt(formData.get("dexNumber")),
          set: formData.get("set"),
          setNumber: formData.get("setNumber"),
          currentPrice: parseFloat(formData.get("currentPrice")) || 0,
          imageUrl: formData.get("imageUrl"),
          owned: formData.get("owned") === "on",
        };
  
        const slabRef = doc(db, "slabs", slabId);
        await updateDoc(slabRef, updatedSlab);
  
        // Update local data
        const slabIndex = slabs.findIndex(s => s.id === slabId);
        slabs[slabIndex] = { id: slabId, ...updatedSlab };
  
        editingId = null;
        renderSlabs(slabs);
      });
    });
  
    // Cancel button (just cancel editing)
    document.querySelectorAll(".cancel-slab-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        editingId = null;
        renderSlabs(slabs);
      });
    });

    document.getElementById('ownedSlabCountDisplay').textContent = `${ownedCount} / ${filteredSlabs.length} owned`;

    renderSlabSetTabs(slabs);
    updateTotalSlabPrice(filteredSlabs);
  }

  // Open slab modal example
  function openSlabModal(imageUrl, slabName) {
    const modal = document.getElementById("slabModal");
    const modalContent = document.getElementById("slabModalContent");
  
    modal.style.display = "flex";
    modal.classList.add("show");  // ADD THIS LINE to trigger opacity and scale transition
  
    modalContent.innerHTML = imageUrl
      ? `<img src="${imageUrl}" alt="${slabName}" style="max-width:100%; height:auto; border-radius: 8px;">`
      : `<p>No image found for ${slabName}</p>`;
  }
  

document.getElementById("slabCloseModal").addEventListener("click", () => {
  console.log("This is a test");
  const modal = document.getElementById("slabModal");
  modal.style.display = "none";
  modal.classList.remove("show");
});

  // Close slab modal when clicking outside the content
document.getElementById("slabModal").addEventListener("click", (e) => {
  const wrapper = document.getElementById("slabModalContentWrapper");

  // If the click is outside the modal content wrapper, close
  if (!wrapper.contains(e.target)) {
    e.stopPropagation(); // Optional: prevent event bubbling
    document.getElementById("slabModal").style.display = "none";
    document.getElementById("slabModal").classList.remove("show");
  }
});


document.getElementById('searchSlabInput').addEventListener('input', () => renderSlabs(slabs));
document.getElementById('sortSlabOptions').addEventListener('change', () => renderSlabs(slabs));
document.getElementById('filterSlabOptions').addEventListener('change', () => renderSlabs(slabs));

// do this after login
// loadSlabs();

document.getElementById("addSlabForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const newSlab = {
      name: document.getElementById("slabName").value,
      dexNumber: parseInt(document.getElementById("slabDexNumber").value),
      set: document.getElementById("slabSet").value,
      setNumber: document.getElementById("slabSetNumber").value,
      currentPrice: parseFloat(document.getElementById("slabPrice").value) || 0,
      imageUrl: document.getElementById("slabImageUrl").value,
      owned: document.getElementById("slabOwned").checked,
    };
    console.log("Submitting slab:", newSlab); // ✅ now it's defined!


    await addDoc(collection(db, "slabs"), newSlab);
    e.target.reset(); // Clear form after submission
    loadSlabs();
    console.log("Slab added successfully!");
  } catch (error) {
    console.error("Error adding slab:", error);
  }
});

document.getElementById("csvSlabInput").addEventListener("change", async (e) => {
  console.log("File selected!");

  const file = e.target.files[0];
  if (!file) return console.warn("No file selected.");

  const text = await file.text();
  console.log("File contents:", text);

  const rows = text.trim().split("\n");
  const headers = rows[0].split(",").map(h => h.trim());

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(",").map(v => v.trim());
    // Skip empty or incomplete rows
    if (values.length !== headers.length) {
      console.warn(`Skipping malformed row ${i + 1}: ${rows[i]}`);
      continue;
    }
    const slab = {};
    headers.forEach((header, idx) => {
      let val = values[idx];
      if (header === "dexNumber") {
        slab[header] = parseInt(val) || 0;
      } else if (header === "currentPrice") {
        slab[header] = parseFloat(val) || 0;
      } else if (header === "owned") {
        slab[header] = val.toLowerCase() === "true";
      } else {
        slab[header] = val;
      }
    });
    console.log("Adding slab to Firestore:", slab);
    try {
      await addDoc(collection(db, "slabs"), slab);
    } catch (err) {
      console.error("Error adding slab:", err);
    }
  }
  loadSlabs();
  alert("Slabs imported successfully!");
});

function renderSlabSetTabs(slabs) {
  const tabContainer = document.getElementById("setSlabTabs");
  tabContainer.innerHTML = "";
  
  const sets = [
      "Base Set", "Jungle", "Fossil", "Base Set 2", "Team Rocket",
      "Gym Heroes", "Gym Challenge",
      "Neo Genesis", "Neo Discovery", "Neo Revelation", "Neo Destiny", 
      "Legendary Collection",
      "Expedition","Aquapolis", "Skyridge",
      "EX Ruby & Sapphire", "EX Sandstorm", "EX Dragon", "EX Team Magma vs Team Aqua", "EX Hidden Legends", "EX FireRed & LeafGreen",
      "EX Team Rocket Returns", "EX Deoxys", "EX Emerald", "EX Unseen Forces", "EX Delta Species", "EX Legend Maker", "EX Holon Phantoms",
      "EX Crystal Guardians", "EX Dragon Frontiers", "EX Power Keepers",
      "Diamond & Pearl", "Mysterious Treasures", "Secret Wonders", "Great Encounters", "Majestic Dawn", "Legends Awakened", "Stormfront",
      "Pop Promos",
      "Platinum", "Rising Rivals", "Supreme Victors", "Arceus", 
      "HeartGold & SoulSilver", "Unleashed", "Undaunted", "Triumphant",
      "Call of Legends",
      "Black & White", "Emerging Powers", "Noble Victories", "Next Destinies", "Dark Explorers", "Dragons Exalted", "Boundaries Crossed",
      "Plasma Storm", "Plasma Freeze", "Plasma Blast", "Legendary Treasures", "BW Radiant Collection",
      "XY Promos", "XY", "Flashfire", "Furious Fists", "Phantom Forces", "Primal Clash", "Double Crisis", "Roaring Skies", "Ancient Origins", 
      "BREAKthrough", "BREAKpoint", "Generations", "Fates Collide", "Steam Siege", "Evolutions",
      "Sun & Moon", "Guardians Rising", "Burning Shadows", "Shining Legends", "Crimson Invasion", "Ultra Prism", "Forbidden Light",
      "Celestial Storm", "Dragon Majesty", "Lost Thunder", "Team Up", "Unbroken Bonds", "Unified Minds", "Hidden Fates", "Cosmic Eclipse",
      "SWSH Promos", "Sword & Shield", "Rebel Clash", "Darkness Ablaze", "Champion's Path", "Vivid Voltage", "Battle Styles", "Chilling Reign",
      "Evolving Skies", "Fusion Strike", "Brilliant Stars", "Brilliant Stars Trainer Gallery", "Astral Radiance", "Astral Radiance Trainer Gallery", 
      "Lost Origin", "Lost Origin Trainer Gallery", "Silver Tempest", "Silver Tempest Trainer Gallery", "Crown Zenith", "Crown Zenith Galarian Gallery",
      "SV Promos", "Scarlet & Violet", "Paldea Evolved", "Obsidian Flames", "151", "Paradox Rift", "Paldean Fates", "Temporal Forces",
      "Twilight Masquerade", "Shrouded Fable", "Stellar Crown", "Surging Sparks", "Prismatic Evolutions", "Journey Together", "Destined Rivals",
      "Black Bolt", "White Flare"
  ];
  
  // Create a lookup map from lowercase set name to proper set name for display
  const setsMap = new Map();
  sets.forEach(setName => {
    setsMap.set(normalizeSetName(setName), setName);
  });    
  
  const slabSetsLower = new Set(slabs.map(slab => normalizeSetName(slab.set)));

  const filteredSets = sets.filter(setName => slabSetsLower.has(normalizeSetName(setName)));
  
  const unmatchedSets = [...slabSetsLower].filter(set => !setsMap.has(set));
  if (unmatchedSets.length > 0) {
      console.warn("Warning: slab sets not matched to master list:", unmatchedSets);
  }
  
  // Always add "All Sets" tab
  const allTab = document.createElement("button");
  allTab.textContent = "📚 All Sets";
  allTab.className = "tab-button";
  allTab.addEventListener("click", () => {
      activeSet = null;
      renderSlabs(slabs);
      setActiveTab(null);
  });
  tabContainer.appendChild(allTab);
  
  // Add tabs for filtered sets, using proper capitalization from setsMap
  filteredSets.forEach(setName => {
      const tab = document.createElement("button");
      tab.textContent = setName; // setName is already proper case
      tab.className = "tab-button";
      tab.addEventListener("click", () => {
      activeSet = setName;
      renderSlabs(slabs);
      setActiveTab(setName);
      });
      tabContainer.appendChild(tab);
  });
  
  // Highlight the active tab
  function setActiveTab(setName) {
      const tabs = tabContainer.querySelectorAll(".tab-button");
      tabs.forEach(tab => {
      tab.classList.toggle("active-tab", tab.textContent === setName || (setName === null && tab.textContent === "📚 All Sets"));
      });
  }
  
  setActiveTab(activeSet);
}

function updateTotalSlabPrice(filteredSlabs) {
  const total = filteredSlabs.reduce((sum, slab) => sum + (slab.currentPrice || 0), 0);
  const display = document.getElementById("totalSlabPriceDisplay");
  display.textContent = `Total Price: $${total.toFixed(2)}`;
}




// BOX STUFF
let boxes = [];

async function loadBoxes() {
  const boxRef = collection(db, "boxes");
  const boxSnapshot = await getDocs(boxRef);
  boxes = boxSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderBoxes(boxes);
}


function renderBoxes(boxes) {
    const boxList = document.getElementById('boxList');
    const searchTerm = document.getElementById('searchBoxInput').value.toLowerCase();
    const sortOption = document.getElementById('sortBoxOptions').value;
    const filterOption = document.getElementById('filterBoxOptions').value;
  
    let filteredBoxes = boxes;

    // 1. Filter by active tab (set)
    if (activeSet) {
      filteredBoxes = filteredBoxes.filter(box => normalizeSetName(box.set) === normalizeSetName(activeSet));
    }
    
    // 2. Apply name search and ownership filter
    filteredBoxes = filteredBoxes.filter(box =>
      box.name.toLowerCase().includes(searchTerm) &&
      (filterOption === 'all' ||
       (filterOption === 'owned' && box.owned) ||
       (filterOption === 'unowned' && !box.owned))
    );
    
    // 3. Apply sorting
    if (sortOption === 'name') {
      filteredBoxes.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === 'dex') {
      filteredBoxes.sort((a, b) => a.dexNumber - b.dexNumber);
    } else if (sortOption === 'set') {
      filteredBoxes.sort((a, b) => a.set.localeCompare(b.set));
    } else if (sortOption === 'price') {
      filteredBoxes.sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (sortOption === 'price-desc') {
      filteredBoxes.sort((a, b) => b.currentPrice - a.currentPrice);
    }
    
  
    boxList.innerHTML = '';
    let ownedCount = 0;
  
    filteredBoxes.forEach(box => {
      if (box.owned) ownedCount++;
  
      const li = document.createElement('li');
      li.classList.add('box');

      if (box.id === editingId) {
        // Render edit form for this box
        li.innerHTML = `
          <form class="edit-box-form" data-id="${box.id}">
            <input name="name" value="${box.name}" required />
            <input name="set" value="${box.set}" required />
            <input name="currentPrice" type="number" step="0.01" value="${box.currentPrice || 0}" />
            <input name="imageUrl" value="${box.imageUrl}" required />
            <label>
              <input name="owned" type="checkbox" ${box.owned ? "checked" : ""} />
              Owned
            </label>
            <button type="submit">Save</button>
            <button type="button" class="cancel-box-btn">Cancel</button>
          </form>
        `;
      } else {
        li.innerHTML = `
        <label>
          <input type="checkbox" ${box.owned ? "checked" : ""} data-id="${box.id}">
          <strong 
            class="box-name" 
            data-boxname="${box.name}" 
            data-imageurl="${box.imageUrl}" 
            style="cursor: pointer; color: blue;">
            ${box.name}
          </strong><br>
          Set: ${box.set}<br>
          Current Price: $${box.currentPrice?.toFixed(2) || "0.00"}
        </label>
        <button class="edit-box-btn" data-id="${box.id}">Edit</button>
        <button class="delete-box-btn" data-id="${box.id}">Delete</button>
      `;
      }

      li.addEventListener('click', () => openModal(box));
      boxList.appendChild(li);
    });

    document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
      if (checkbox.name !== "owned") {  // skip owned checkbox in edit forms
        checkbox.addEventListener("change", async (e) => {
          const boxId = e.target.dataset.id;
          const newStatus = e.target.checked;
          const boxRef = doc(db, "boxes", boxId);
          await updateDoc(boxRef, { owned: newStatus });
  
          boxes.find(b => b.id === boxId).owned = newStatus;
          renderBoxes(boxes);
        });
      }
    });
  
    // modal part
    document.querySelectorAll(".box-name").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
    
        const imageUrl = el.dataset.imageurl;
        const boxName = el.dataset.slabname;
    
        console.log("Opening modal with:", { imageUrl, boxName });

        openBoxModal(imageUrl, boxName);
      });
    });
    
    // Edit buttons: just set editingId and re-render
    document.querySelectorAll(".edit-box-btn").forEach(button => {
      button.addEventListener("click", (e) => {
        editingId = e.target.dataset.id;
        renderBoxes(boxes);
      });
    });
  
    // Delete buttons
    document.querySelectorAll(".delete-box-btn").forEach(button => {
      button.addEventListener("click", async (e) => {
        const boxId = e.target.dataset.id;
        if (!confirm("Are you sure you want to delete this box?")) return;
  
        await deleteDoc(doc(db, "boxes", boxId));
        boxes = boxes.filter(b => b.id !== boxId);
        renderBoxes(boxes);
      });
    });

    // Edit form submit
    document.querySelectorAll(".edit-box-form").forEach(form => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const boxId = form.dataset.id;
  
        const formData = new FormData(form);
        const updatedBox = {
          name: formData.get("name"),
          set: formData.get("set"),
          currentPrice: parseFloat(formData.get("currentPrice")) || 0,
          imageUrl: formData.get("imageUrl"),
          owned: formData.get("owned") === "on",
        };
  
        const boxRef = doc(db, "boxes", boxId);
        await updateDoc(boxRef, updatedBox);
  
        // Update local data
        const boxIndex = boxes.findIndex(b => b.id === boxId);
        boxes[boxIndex] = { id: boxId, ...updatedBox };
  
        editingId = null;
        renderBoxes(boxes);
      });
    });
  
    // Cancel button (just cancel editing)
    document.querySelectorAll(".cancel-box-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        editingId = null;
        renderBoxes(boxes);
      });
    });

    document.getElementById('ownedBoxCountDisplay').textContent = `${ownedCount} / ${filteredBoxes.length} owned`;

    renderBoxSetTabs(boxes);
    updateTotalBoxPrice(filteredBoxes);
  }

  // Open slab modal example
  function openBoxModal(imageUrl, boxName) {
    const modal = document.getElementById("boxModal");
    const modalContent = document.getElementById("boxModalContent");
  
    modal.style.display = "flex";
    modal.classList.add("show");  // ADD THIS LINE to trigger opacity and scale transition
  
    modalContent.innerHTML = imageUrl
      ? `<img src="${imageUrl}" alt="${boxName}" style="max-width:100%; height:auto; border-radius: 8px;">`
      : `<p>No image found for ${boxName}</p>`;
  }
  

document.getElementById("boxCloseModal").addEventListener("click", () => {
  const modal = document.getElementById("boxModal");
  modal.style.display = "none";
  modal.classList.remove("show");
});

  // Close slab modal when clicking outside the content
document.getElementById("boxModal").addEventListener("click", (e) => {
  const wrapper = document.getElementById("boxModalContentWrapper");

  // If the click is outside the modal content wrapper, close
  if (!wrapper.contains(e.target)) {
    e.stopPropagation(); // Optional: prevent event bubbling
    document.getElementById("boxModal").style.display = "none";
    document.getElementById("boxModal").classList.remove("show");
  }
});


document.getElementById('searchBoxInput').addEventListener('input', () => renderBoxes(boxes));
document.getElementById('sortBoxOptions').addEventListener('change', () => renderBoxes(boxes));
document.getElementById('filterBoxOptions').addEventListener('change', () => renderBoxes(boxes));

// do after login
//loadBoxes();

document.getElementById("addBoxForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const newBox = {
      name: document.getElementById("boxName").value,
      set: document.getElementById("boxSet").value,
      currentPrice: parseFloat(document.getElementById("boxPrice").value) || 0,
      imageUrl: document.getElementById("boxImageUrl").value,
      owned: document.getElementById("boxOwned").checked,
    };

    await addDoc(collection(db, "boxes"), newBox);
    e.target.reset(); // Clear form after submission
    loadBoxes();
    console.log("Box added successfully!");
  } catch (error) {
    console.error("Error adding box:", error);
  }
});

document.getElementById("csvBoxInput").addEventListener("change", async (e) => {
  console.log("File selected!");

  const file = e.target.files[0];
  if (!file) return console.warn("No file selected.");

  const text = await file.text();
  console.log("File contents:", text);

  const rows = text.trim().split("\n");
  const headers = rows[0].split(",").map(h => h.trim());

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(",").map(v => v.trim());
    // Skip empty or incomplete rows
    if (values.length !== headers.length) {
      console.warn(`Skipping malformed row ${i + 1}: ${rows[i]}`);
      continue;
    }
    const box = {};
    headers.forEach((header, idx) => {
      let val = values[idx];
      if (header === "currentPrice") {
        box[header] = parseFloat(val) || 0;
      } else if (header === "owned") {
        box[header] = val.toLowerCase() === "true";
      } else {
        box[header] = val;
      }
    });
    console.log("Adding box to Firestore:", box);
    try {
      await addDoc(collection(db, "boxes"), box);
    } catch (err) {
      console.error("Error adding box:", err);
    }
  }
  loadBoxes();
  alert("Boxes imported successfully!");
});

function renderBoxSetTabs(boxes) {
  const tabContainer = document.getElementById("setBoxTabs");
  tabContainer.innerHTML = "";
  
  const sets = [
      "Elite Trainer Box", "Pokémon Center Elite Trainer Box", "Booster Box", "Ultra Premium Collection Box", 
      "Premium Collection Box", "Collection Box", "Other"
  ];
  
  // Create a lookup map from lowercase set name to proper set name for display
  const setsMap = new Map();
  sets.forEach(setName => {
    setsMap.set(normalizeSetName(setName), setName);
  });    
  
  const boxSetsLower = new Set(boxes.map(box => normalizeSetName(box.set)));

  const filteredSets = sets.filter(setName => boxSetsLower.has(normalizeSetName(setName)));
  
  const unmatchedSets = [...boxSetsLower].filter(set => !setsMap.has(set));
  if (unmatchedSets.length > 0) {
      console.warn("Warning: box sets not matched to master list:", unmatchedSets);
  }
  
  // Always add "All Sets" tab
  const allTab = document.createElement("button");
  allTab.textContent = "📚 All Sets";
  allTab.className = "tab-button";
  allTab.addEventListener("click", () => {
      activeSet = null;
      renderBoxes(boxes);
      setActiveTab(null);
  });
  tabContainer.appendChild(allTab);
  
  // Add tabs for filtered sets, using proper capitalization from setsMap
  filteredSets.forEach(setName => {
      const tab = document.createElement("button");
      tab.textContent = setName; // setName is already proper case
      tab.className = "tab-button";
      tab.addEventListener("click", () => {
      activeSet = setName;
      renderBoxes(boxes);
      setActiveTab(setName);
      });
      tabContainer.appendChild(tab);
  });
  
  // Highlight the active tab
  function setActiveTab(setName) {
      const tabs = tabContainer.querySelectorAll(".tab-button");
      tabs.forEach(tab => {
      tab.classList.toggle("active-tab", tab.textContent === setName || (setName === null && tab.textContent === "📚 All Sets"));
      });
  }
  
  setActiveTab(activeSet);
}

function updateTotalBoxPrice(filteredBoxes) {
  const total = filteredBoxes.reduce((sum, box) => sum + (box.currentPrice || 0), 0);
  const display = document.getElementById("totalBoxPriceDisplay");
  display.textContent = `Total Price: $${total.toFixed(2)}`;
}




// AUTH
const auth = getAuth(app);

// Handle signup
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Signup error: " + err.message);
  }
});

// Handle login
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    alert("Login error: " + err.message);
  }
});

// Handle logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth);
});

// Show/hide content based on auth state
onAuthStateChanged(auth, (user) => {
  const loggedIn = !!user;

  document.getElementById("authSection").style.display = loggedIn ? "none" : "block";
  document.getElementById("logoutBtn").style.display = loggedIn ? "inline-block" : "none";

  // Hide/show your collections
  const tabs = document.getElementById("tabs");
  const cardCollection = document.getElementById("cardCollection");
  const slabCollection = document.getElementById("slabCollection");
  const boxCollection = document.getElementById("boxCollection");

  if (loggedIn) {
    tabs.style.display = "block";
    cardCollection.style.display = "block";
    fetchCards();
    loadSlabs();
    loadBoxes();
  } else {
    tabs.style.display = "none";
    cardCollection.style.display = "none";
    slabCollection.style.display = "none";
    boxCollection.style.display = "none";
  }
});
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      console.log("User logged in:", result.user);
    }
  })
  .catch((error) => {
    console.error("Login error:", error);
  });