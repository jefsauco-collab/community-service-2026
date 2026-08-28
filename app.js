const form = document.querySelector('#customer-form');
const submitCustomerButton = form.querySelector('button[type="submit"]');
const contactNumberInput = document.querySelector('#contact-number');
const list = document.querySelector('#customer-list');
const emptyState = document.querySelector('#empty-state');
const count = document.querySelector('#customer-count');
const message = document.querySelector('#form-message');
const printButton = document.querySelector('#print-records');
const printSelectedButton = document.querySelector('#print-selected');
const refreshRecordsButton = document.querySelector('#refresh-records');
const customerFilter = document.querySelector('#customer-filter');
const serviceHint = document.querySelector('#service-hint');
const recordsMessage = document.querySelector('#records-message');
const entrySubmissionConfirmation = document.querySelector('#entry-submission-confirmation');
const submittedCustomerNumber = document.querySelector('#submitted-customer-number');
const submittedCustomerName = document.querySelector('#submitted-customer-name');
const printDialog = document.querySelector('#print-dialog');
const printDetailsForm = document.querySelector('#print-details-form');
const printCustomerFields = document.querySelector('#print-customer-fields');
const cancelPrintButton = document.querySelector('#cancel-print');
const storageKey = 'customer-directory-records';
const googleSheetsEndpoint = 'https://script.google.com/macros/s/AKfycbyCojXcgAEqSa5zf70dh-NOuYYgtCyDAhvIYpHdlYttpjw7cGt_2NQ_yEwzf5xt4dp9/exec';
const entryOnlyMode = new URLSearchParams(window.location.search).get('mode') === 'entry';
const serviceNameUpdates = {
  Medical: 'Medical Check-up',
  Dental: 'Dental Check-up',
  'Eye Checkup (Cataract Screening)': 'Eye Check-up (Cataract Screening)',
  'Reading Glass': 'Reading Glasses',
};

let customers = JSON.parse(localStorage.getItem(storageKey) || '[]');
const selectedCustomerIds = new Set();

function customerNumber(index) {
  return `CUST-${String(index).padStart(4, '0')}`;
}

function assignMissingCustomerNumbers() {
  let highestNumber = customers.reduce((highest, customer) => {
    const match = customer.customerNumber?.match(/^(?:CUST-)?(\d+)$/);
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);
  let changed = false;
  customers.forEach((customer) => {
    if (!customer.customerNumber) {
      highestNumber += 1;
      customer.customerNumber = customerNumber(highestNumber);
      changed = true;
    }
  });
  if (changed) saveCustomers();
}

function nextCustomerNumber() {
  const highestNumber = customers.reduce((highest, customer) => {
    const match = customer.customerNumber?.match(/^(?:CUST-)?(\d+)$/);
    return Math.max(highest, match ? Number(match[1]) : 0);
  }, 0);
  return customerNumber(highestNumber + 1);
}

function updatePrintSelectedButton() {
  const selectedCount = selectedCustomerIds.size;
  printSelectedButton.disabled = selectedCount === 0;
  printSelectedButton.textContent = `Print selected (${selectedCount})`;
}

function showEntrySubmissionConfirmation(customer) {
  document.querySelector('.intro').hidden = true;
  document.querySelector('.form-card').hidden = true;
  submittedCustomerNumber.textContent = customer.customerNumber;
  submittedCustomerName.textContent = customer.name;
  entrySubmissionConfirmation.hidden = false;
}

function formatBirthday(value) {
  if (!value) return 'Not provided';
  const birthday = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthday.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(birthday);
}

function createDetail(label, value) {
  const detail = document.createElement('div');
  detail.className = 'detail-item';
  if (label === 'Address') detail.classList.add('detail-address');
  const detailLabel = document.createElement('strong');
  detailLabel.textContent = `${label}: `;
  detail.append(detailLabel, value);
  return detail;
}

function createPrintVital(label, value = '') {
  const vital = document.createElement('div');
  vital.className = 'print-vital';
  vital.append(`${label}: `);
  const line = document.createElement('span');
  line.className = value ? 'print-vital-value' : 'print-vital-line';
  line.textContent = value;
  vital.append(line);
  return vital;
}

function selectedCustomers() {
  return customers.filter((customer) => selectedCustomerIds.has(customer.id));
}

function setPrintVitals(container, bloodPressure = '', temperature = '', weight = '') {
  container.replaceChildren(
    createPrintVital('Blood pressure', bloodPressure),
    createPrintVital('Temperature', temperature ? `${temperature} °C` : ''),
    createPrintVital('Weight', weight ? `${weight} kg` : ''),
  );
}

function setPrintComplaint(container, complaint = '') {
  container.replaceChildren();
  const label = document.createElement('strong');
  label.textContent = 'Chief Complaint';
  const value = document.createElement('div');
  value.className = 'print-complaint-value';
  value.textContent = complaint;
  container.append(label, value);
}

function setPrintRemarks(container, remarks = '') {
  container.replaceChildren();
  const label = document.createElement('strong');
  label.textContent = 'Remarks';
  const value = document.createElement('div');
  value.className = 'print-remarks-value';
  value.textContent = remarks;
  container.append(label, value);
}

function createPrintSummaryItem(label, value) {
  const item = document.createElement('div');
  const itemLabel = document.createElement('strong');
  itemLabel.textContent = `${label}: `;
  item.append(itemLabel, value);
  return item;
}

function createServiceCheckboxGroup(className, selectedServices) {
  const group = document.createElement('div');
  group.className = className;
  const heading = document.createElement('strong');
  heading.textContent = 'Services:';
  group.append(heading);
  if (selectedServices.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = 'No service selected';
    group.append(empty);
  }
  selectedServices.forEach((service) => {
    const label = document.createElement('label');
    label.className = 'print-service-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    checkbox.disabled = true;
    label.append(checkbox, service);
    group.append(label);
  });
  return group;
}

function openPrintDetailsDialog() {
  printCustomerFields.replaceChildren();
  selectedCustomers().forEach((customer) => {
    const section = document.createElement('section');
    section.className = 'print-customer-field';
    const title = document.createElement('h3');
    title.textContent = `${customer.customerNumber} — ${customer.name}`;
    const summary = document.createElement('div');
    summary.className = 'print-customer-summary';
    summary.append(
      createPrintSummaryItem('Age', `${customer.age} years`),
      createPrintSummaryItem('Birthday', formatBirthday(customer.birthday)),
      createPrintSummaryItem('Address', customer.address || 'Not provided'),
      createPrintSummaryItem('Contact number', customer.contactNumber || 'Not provided'),
      createPrintSummaryItem('Emergency Contact Name and Number', customer.emergencyContactName || 'Not provided'),
      createServiceCheckboxGroup('print-summary-services', customer.services || []),
    );
    const fieldGrid = document.createElement('div');
    fieldGrid.className = 'field-grid';

    const bloodPressureLabel = document.createElement('label');
    bloodPressureLabel.textContent = 'Blood pressure';
    const bloodPressure = document.createElement('input');
    bloodPressure.type = 'text';
    bloodPressure.name = `bloodPressure-${customer.id}`;
    bloodPressureLabel.append(bloodPressure);

    const temperatureLabel = document.createElement('label');
    temperatureLabel.textContent = 'Temperature (°C)';
    const temperature = document.createElement('input');
    temperature.type = 'number';
    temperature.name = `temperature-${customer.id}`;
    temperature.min = '30';
    temperature.max = '45';
    temperature.step = '0.1';
    temperatureLabel.append(temperature);

    const weightLabel = document.createElement('label');
    weightLabel.textContent = 'Weight (kg)';
    const weight = document.createElement('input');
    weight.type = 'number';
    weight.name = `weight-${customer.id}`;
    weight.min = '0';
    weight.step = '0.1';
    weightLabel.append(weight);

    fieldGrid.append(bloodPressureLabel, temperatureLabel, weightLabel);
    const complaintLabel = document.createElement('label');
    complaintLabel.textContent = 'Chief Complaint';
    const complaint = document.createElement('textarea');
    complaint.name = `chiefComplaint-${customer.id}`;
    complaint.maxLength = 500;
    complaint.rows = 3;
    complaintLabel.append(complaint);

    const remarksLabel = document.createElement('label');
    remarksLabel.textContent = 'Remarks';
    const remarks = document.createElement('textarea');
    remarks.name = `remarks-${customer.id}`;
    remarks.maxLength = 500;
    remarks.rows = 3;
    remarksLabel.append(remarks);

    section.append(title, summary, fieldGrid, complaintLabel, remarksLabel);
    printCustomerFields.append(section);
  });
  printDialog.showModal();
}

function updateServiceSelectionLimit() {
  const serviceInputs = [...form.querySelectorAll('input[name="services"]')];
  const selectedCount = serviceInputs.filter((input) => input.checked).length;
  serviceInputs.forEach((input) => {
    input.disabled = selectedCount >= 3 && !input.checked;
  });
  serviceHint.textContent = selectedCount >= 3
    ? 'Maximum of 3 services selected.'
    : `Select up to 3 services (${3 - selectedCount} remaining).`;
}

function saveCustomers() {
  localStorage.setItem(storageKey, JSON.stringify(customers));
}

async function saveToGoogleSheets(customer) {
  await fetch(googleSheetsEndpoint, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(customer),
  });
  return customer;
}

async function deleteFromGoogleSheets(customer) {
  const response = await fetch(googleSheetsEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'delete',
      id: customer.id,
      customerNumber: customer.customerNumber,
    }),
  });
  if (!response.ok) throw new Error('Google Sheets could not delete the record.');
  const result = await response.json();
  if (!result.ok) throw new Error(result.message || 'Google Sheets could not delete the record.');
}

function normaliseBirthday(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function normaliseCustomer(record) {
  return {
    id: String(record.id || record.customerNumber || crypto.randomUUID()),
    customerNumber: String(record.customerNumber || ''),
    name: String(record.name || ''),
    age: Number(record.age || 0),
    birthday: normaliseBirthday(record.birthday),
    gender: String(record.gender || ''),
    address: String(record.address || ''),
    contactNumber: String(record.contactNumber || ''),
    emergencyContactName: String(record.emergencyContactName || ''),
    services: Array.isArray(record.services)
      ? record.services.map(String)
      : String(record.services || '').split(/\s*\|\s*|\s*,\s*/).filter(Boolean),
  };
}

async function loadRecordsFromGoogleSheets(showStatus = true) {
  if (entryOnlyMode) return;
  if (showStatus) recordsMessage.textContent = 'Refreshing records from Google Sheets…';
  refreshRecordsButton.disabled = true;
  try {
    const url = new URL(googleSheetsEndpoint);
    url.searchParams.set('action', 'records');
    url.searchParams.set('_', Date.now());
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Google Sheets could not load the records.');
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.records)) {
      throw new Error(result.message || 'Google Sheets could not load the records.');
    }
    customers = result.records.map(normaliseCustomer).filter((customer) => customer.name && customer.customerNumber);
    selectedCustomerIds.clear();
    saveCustomers();
    renderCustomers();
    updatePrintSelectedButton();
    recordsMessage.textContent = `Loaded ${customers.length} record${customers.length === 1 ? '' : 's'} from Google Sheets.`;
  } catch (error) {
    recordsMessage.textContent = 'Could not load Google Sheets records. Showing records saved on this device.';
  } finally {
    refreshRecordsButton.disabled = false;
  }
}

function removeLegacyHiddenData() {
  const hasRemovedData = customers.some((customer) => (
    Object.hasOwn(customer, 'bloodPressure')
    || Object.hasOwn(customer, 'temperature')
    || Object.hasOwn(customer, 'emergencyContactNumber')
  ));
  if (!hasRemovedData) return;
  customers = customers.map(({ bloodPressure, temperature, emergencyContactNumber, ...customer }) => customer);
  saveCustomers();
}

function updateSavedServiceNames() {
  let changed = false;
  customers.forEach((customer) => {
    if (!customer.services) return;
    customer.services = customer.services.map((service) => {
      const updatedName = serviceNameUpdates[service] || service;
      changed ||= updatedName !== service;
      return updatedName;
    });
  });
  if (changed) saveCustomers();
}

function renderCustomers() {
  const filterText = customerFilter.value.trim().toLowerCase();
  const visibleCustomers = customers.filter((customer) => (
    customer.name.toLowerCase().includes(filterText)
    || customer.customerNumber.toLowerCase().includes(filterText)
  ));
  list.replaceChildren();
  emptyState.hidden = visibleCustomers.length > 0;
  count.textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'}`;

  visibleCustomers.forEach((customer) => {
    const row = document.createElement('article');
    row.className = 'customer-row';
    row.dataset.customerId = customer.id;
    row.classList.toggle('is-selected', selectedCustomerIds.has(customer.id));

    const select = document.createElement('input');
    select.className = 'customer-select';
    select.type = 'checkbox';
    select.checked = selectedCustomerIds.has(customer.id);
    select.setAttribute('aria-label', `Select ${customer.name} for printing`);
    select.addEventListener('change', () => {
      if (select.checked) {
        selectedCustomerIds.add(customer.id);
      } else {
        selectedCustomerIds.delete(customer.id);
      }
      row.classList.toggle('is-selected', select.checked);
      updatePrintSelectedButton();
    });

    const number = document.createElement('div');
    number.className = 'customer-number';
    number.textContent = customer.customerNumber;

    const name = document.createElement('div');
    name.className = 'patient-identity';
    const nameText = document.createElement('div');
    nameText.className = 'customer-name';
    nameText.textContent = customer.name;
    const gender = document.createElement('div');
    gender.className = 'customer-gender';
    gender.textContent = customer.gender || 'Gender not provided';
    name.append(nameText, gender);

    const details = document.createElement('div');
    details.className = 'customer-details';
    details.append(
      createDetail('Age', `${customer.age} years`),
      createDetail('Birthday', formatBirthday(customer.birthday)),
      createDetail('Address', customer.address || 'Not provided'),
      createDetail('Contact', customer.contactNumber || 'Not provided'),
      createDetail('Emergency Contact Name and Number', customer.emergencyContactName || 'Not provided'),
    );

    const services = document.createElement('div');
    services.className = 'service-tags';
    (customer.services || ['No service selected']).forEach((service) => {
      const tag = document.createElement('span');
      tag.className = 'service-tag';
      tag.textContent = service;
      services.append(tag);
    });

    const printServices = createServiceCheckboxGroup('print-services', customer.services || []);

    const printVitals = document.createElement('div');
    printVitals.className = 'print-vitals';
    printVitals.append(
      createPrintVital('Blood pressure'),
      createPrintVital('Temperature'),
      createPrintVital('Weight'),
    );

    const printComplaint = document.createElement('div');
    printComplaint.className = 'print-complaint';
    setPrintComplaint(printComplaint);

    const printRemarks = document.createElement('div');
    printRemarks.className = 'print-remarks';
    setPrintRemarks(printRemarks);

    const remove = document.createElement('button');
    remove.className = 'delete-button';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Permanently delete ${customer.name} from the app and Google Sheets?`)) return;
      remove.disabled = true;
      try {
        await deleteFromGoogleSheets(customer);
        customers = customers.filter((item) => item.id !== customer.id);
        selectedCustomerIds.delete(customer.id);
        saveCustomers();
        renderCustomers();
        updatePrintSelectedButton();
        recordsMessage.textContent = `${customer.name} was deleted from Google Sheets.`;
      } catch (error) {
        recordsMessage.textContent = error.message || 'The record could not be deleted.';
        remove.disabled = false;
      }
    });

    row.append(select, number, name, details, services, printServices, printVitals, printComplaint, printRemarks, remove);
    list.append(row);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(form);
  const selectedServices = values.getAll('services');
  if (selectedServices.length === 0) {
    message.textContent = 'Please select at least one service.';
    return;
  }
  if (selectedServices.length > 3) {
    message.textContent = 'Please select no more than 3 services.';
    return;
  }
  submitCustomerButton.disabled = true;
  let customer = {
    id: crypto.randomUUID(),
    customerNumber: nextCustomerNumber(),
    name: values.get('name').trim(),
    age: Number(values.get('age')),
    birthday: values.get('birthday'),
    gender: values.get('gender'),
    address: values.get('address').trim(),
    contactNumber: values.get('contactNumber').trim(),
    emergencyContactName: values.get('emergencyContactName').trim(),
    services: selectedServices,
  };

  let sentToGoogleSheets = true;
  try {
    customer = await saveToGoogleSheets(customer);
  } catch (error) {
    sentToGoogleSheets = false;
  }

  customers.unshift(customer);
  saveCustomers();
  if (!entryOnlyMode) renderCustomers();
  form.reset();
  updateServiceSelectionLimit();
  if (entryOnlyMode && sentToGoogleSheets) {
    showEntrySubmissionConfirmation(customer);
    return;
  }
  if (sentToGoogleSheets) {
    message.textContent = entryOnlyMode
      ? `${customer.customerNumber} - ${customer.name} has been submitted.`
      : `${customer.name} was submitted to Google Sheets. Use Refresh records to confirm it appears.`;
  } else {
    message.textContent = `${customer.name} was saved on this device, but could not be sent to Google Sheets.`;
  }
  submitCustomerButton.disabled = false;
  document.querySelector('#name').focus();
});

printButton.addEventListener('click', () => {
  document.body.classList.remove('print-selected');
  document.querySelectorAll('.print-vitals').forEach((vitals) => setPrintVitals(vitals));
  document.querySelectorAll('.print-complaint').forEach((complaint) => setPrintComplaint(complaint));
  document.querySelectorAll('.print-remarks').forEach((remarks) => setPrintRemarks(remarks));
  window.print();
});
printSelectedButton.addEventListener('click', openPrintDetailsDialog);
refreshRecordsButton.addEventListener('click', () => loadRecordsFromGoogleSheets());
cancelPrintButton.addEventListener('click', () => printDialog.close());
printDetailsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!printDetailsForm.reportValidity()) return;
  const values = new FormData(printDetailsForm);
  customerFilter.value = '';
  renderCustomers();
  selectedCustomers().forEach((customer) => {
    const row = document.querySelector(`[data-customer-id="${customer.id}"]`);
    const vitals = row.querySelector('.print-vitals');
    setPrintVitals(
      vitals,
      values.get(`bloodPressure-${customer.id}`),
      values.get(`temperature-${customer.id}`),
      values.get(`weight-${customer.id}`),
    );
    setPrintComplaint(
      row.querySelector('.print-complaint'),
      values.get(`chiefComplaint-${customer.id}`),
    );
    setPrintRemarks(
      row.querySelector('.print-remarks'),
      values.get(`remarks-${customer.id}`),
    );
  });
  printDialog.close();
  document.body.classList.add('print-selected');
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('print-selected'));
customerFilter.addEventListener('input', renderCustomers);
contactNumberInput.addEventListener('input', () => {
  contactNumberInput.value = contactNumberInput.value.replace(/\D/g, '');
});
form.querySelectorAll('input[name="services"]').forEach((input) => {
  input.addEventListener('change', updateServiceSelectionLimit);
});

removeLegacyHiddenData();
updateSavedServiceNames();
assignMissingCustomerNumbers();
updateServiceSelectionLimit();

if (entryOnlyMode) {
  document.querySelector('.directory-card').hidden = true;
} else {
  renderCustomers();
  updatePrintSelectedButton();
  loadRecordsFromGoogleSheets(false);
}
