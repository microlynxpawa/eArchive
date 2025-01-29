function updateDateTime() {
  const dateTimeElement = document.getElementById("current-date-time");
  const now = new Date();

  // Format date and time
  const options = { year: "numeric", month: "long", day: "numeric" };
  const date = now.toLocaleDateString(undefined, options);
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Update the element
  dateTimeElement.textContent = `${date}, ${time}`;
}

// Update the time every second
setInterval(updateDateTime, 1000);

// Initialize date and time on page load
updateDateTime();

const departmentPermission = document.getElementById("departmentPermission");
const editDepartmentModal = document.getElementById("edit-department-modal");
const accessControlModal = document.getElementById("access-control-modal");

// Open department access control modal
departmentPermission.addEventListener("click", (e) => {
  e.preventDefault();
  accessControlModal.style.display = "none";
  editDepartmentModal.style.display = "flex";
});
