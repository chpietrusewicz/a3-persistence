// FRONT-END (CLIENT) JAVASCRIPT HERE

const submit = async function (event) {
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // stop form submission from trying to load
  // a new .html page for displaying results...
  // this was the original browser behavior and still
  // remains to this day
  event.preventDefault();

  const itemVal = document.querySelector("#item"),
    categoryVal = document.querySelector("#category"),
    quantityVal = document.querySelector("#quantity"),
    utilizationVal = document.querySelector("#utilization"),
    notesVal = document.querySelector("#notes")
    json = {
      item: itemVal.value,
      category: categoryVal.value,
      quantity: quantityVal.value,
      utilization: utilizationVal.value,
      notes: notesVal.value,
    },
    body = JSON.stringify(json);

  const response = await fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await response.json();

  itemVal.value = "";
  quantityVal.value = "";

  renderTable(data);
};

const renderTable = function (appdata) {
  const tbody = document.querySelector("#grocery-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  appdata.forEach((entry, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.item}</td>
      <td>${entry.category}</td>
      <td>${entry.quantity}</td>
      <td>${entry.utilization}</td>
      <td>${entry.status}</td>
      <td>${entry.notes ?? ""}</td>
      <td> 
      <button class="outline" onclick="deleteRow('${entry._id}')">Delete</button> 
      <button class="outline" onclick="adjustQuantity('${entry._id}')">Adjust Quantity</button>
      </td>`;
    tbody.appendChild(row);
  });
};

async function deleteRow(id) {
  const response = await fetch(`/delete/${id}`, {
    method: "DELETE",
  });
  const data = await response.json();
  renderTable(data);
}

async function adjustQuantity(id) {
  const newQuantity = prompt("Enter the new quantity:");

  if (newQuantity !== null) {
    const response = await fetch(`/data/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quantity: newQuantity,
      }),
    });

    const data = await response.json();
    renderTable(data);
  }
}

const fetchData = async function () {
  const response = await fetch("/data");
  const data = await response.json();
  renderTable(data);
};

window.onload = function () {
  const form = document.querySelector("#groceries");
  form.addEventListener("submit", submit);
  fetchData();
};
