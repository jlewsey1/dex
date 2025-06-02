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

// Render cards
function renderCards(dataToRender = cards) {
    let filtered = [...dataToRender];
  
    const sort = sortOptions.value;
    const filter = filterOptions.value;
  
    if (filter === "owned") filtered = filtered.filter(card => card.owned);
    else if (filter === "unowned") filtered = filtered.filter(card => !card.owned);
  
    if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "dex") filtered.sort((a, b) => a.dexNumber - b.dexNumber);
    else if (sort === "set") filtered.sort((a, b) => a.set.localeCompare(b.set));
  
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
              <input name="buyPrice" type="number" step="0.01" value="${card.buyPrice || 0}" />
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
              <strong>${card.name}</strong><br>
              Dex #: ${card.dexNumber} | Set: ${card.set} | Set #: ${card.setNumber}<br>
              Buy Price: $${card.buyPrice?.toFixed(2) || "0.00"} | Current Price: $${card.currentPrice?.toFixed(2) || "0.00"}
            </label>
            <button class="edit-btn" data-id="${card.id}">Edit</button>
            <button class="delete-btn" data-id="${card.id}">Delete</button>
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
            buyPrice: parseFloat(formData.get("buyPrice")) || 0,
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
    buyPrice: parseFloat(document.getElementById("buyPrice").value) || 0,
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
        else if (header === "buyPrice" || header === "currentPrice") card[header] = parseFloat(val);
        else if (header === "owned") card[header] = val.toLowerCase() === "true";
        else card[header] = val;
      });
  
      console.log("Adding card to Firestore:", card);
      await addDoc(collection(db, "cards"), card);
    }
  
    alert("Cards imported successfully!");
    fetchCards(); // Refresh list
  });
  
  