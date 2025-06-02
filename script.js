// Import Firebase from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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
            Dex #: ${card.dexNumber} | Set: ${card.set} | Set #: ${card.setNumber}<br>
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
            ? `<img src="${imageUrl}" alt="Card Image" style="max-width:100%; height:auto;">`
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
}

  
  

// Event listeners
sortOptions.addEventListener("change", () => renderCards(cards));
filterOptions.addEventListener("change", () => renderCards(cards));

// Fetch on page load
fetchCards();

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
        "XY", "Flashfire", "Furious Fists", "Phantom Forces", "Primal Clash", "Double Crisis", "Roaring Skies", "Ancient Origins", 
        "BREAKthrough", "BREAKpoint", "Generations", "Fates Collide", "Steam Siege", "Evolutions",
        "Sun & Moon", "Guardians Rising", "Burning Shadows", "Shining Legends", "Crimson Invasion", "Ultra Prism", "Forbidden Light",
        "Celestial Storm", "Dragon Majesty", "Lost Thunder", "Team Up", "Unbroken Bonds", "Unified Minds", "Hidden Fates", "Cosmic Eclipse",
        "SWSH Promos", "Sword & Shield", "Rebel Clash", "Darkness Ablaze", "Champion's Path", "Vivid Voltage", "Battle Styles", "Chilling Reign",
        "Evolving Skies", "Fusion Strike", "Brilliant Stars", "Brilliant Stars Trainer Gallery", "Astral Radiance", "Astral Radiance Trainer Gallery", 
        "Lost Origin", "Lost Origin Trainer Gallery", "Silver Tempest", "Silver Tempest Trainer Gallery", "Crown Zenith", "Crown Zenith Galarian Gallery",
        "SV Promos", "Scarlet & Violet", "Paldea Evolved", "Obsidian Flames", "151", "Paradox Rift", "Paldean Fates", "Temporal Forces",
        "Twilight Masquerade", "Shrouded Fable", "Stellar Crown", "Surging Sparks", "Prismatic Evolutions", "Journey Together", "Destined Rvials",
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
  

const tabs = document.querySelectorAll(".tab-btn");
const pages = {
  cardCollection: document.getElementById("cardCollection"),
  slabCollection: document.getElementById("slabCollection"),
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
