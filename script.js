// Import Firebase from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// Fetch cards from Firestore
async function fetchCards() {
  console.log("Fetching cards...");
  const querySnapshot = await getDocs(collection(db, "cards"));
  cards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderCards(cards);
}

// Render cards
function renderCards(data) {
  const sort = sortOptions.value;
  const filter = filterOptions.value;

  let filtered = [...data];
  if (filter === "owned") filtered = filtered.filter(card => card.owned);
  else if (filter === "unowned") filtered = filtered.filter(card => !card.owned);

  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "dex") filtered.sort((a, b) => a.dexNumber - b.dexNumber);
  else if (sort === "set") filtered.sort((a, b) => a.set.localeCompare(b.set));

  cardList.innerHTML = "";

  filtered.forEach(card => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" ${card.owned ? "checked" : ""} data-id="${card.id}">
        ${card.name} (Dex #${card.dexNumber}, ${card.set})
      </label>
    `;
    cardList.appendChild(li);
  });

  document.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", async (e) => {
      const cardId = e.target.dataset.id;
      const newStatus = e.target.checked;
      const cardRef = doc(db, "cards", cardId);
      await updateDoc(cardRef, { owned: newStatus });

      cards.find(c => c.id === cardId).owned = newStatus;
      renderCards(cards);
    });
  });
}

// Event listeners
sortOptions.addEventListener("change", () => renderCards(cards));
filterOptions.addEventListener("change", () => renderCards(cards));

// Fetch on page load
fetchCards();
