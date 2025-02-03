document.addEventListener("DOMContentLoaded", () => {
  // Update Date and Time Function
  function updateDateTime() {
    const dateTimeElement = document.getElementById("current-date-time");
    if (!dateTimeElement) {
      console.error("Element with ID 'current-date-time' not found.");
      return;
    }
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

  // Access Control Modal Elements
  const departmentPermission = document.getElementById("departmentPermission");
  const editDepartmentModal = document.getElementById("edit-department-modal");
  const accessControlModal = document.getElementById("access-control-modal");

  // Check if elements exist
  if (!departmentPermission) {
    console.error("Element with ID 'departmentPermission' not found.");
  }
  if (!editDepartmentModal) {
    console.error("Element with ID 'edit-department-modal' not found.");
  }
  if (!accessControlModal) {
    console.error("Element with ID 'access-control-modal' not found.");
  }

  // Open department access control modal
  if (departmentPermission) {
    departmentPermission.addEventListener("click", (e) => {
      e.preventDefault();
      accessControlModal.style.display = "none";
      editDepartmentModal.style.display = "flex";
    });
  } else {
    console.error("departmentPermission element is not available to attach event listener.");
  }
});