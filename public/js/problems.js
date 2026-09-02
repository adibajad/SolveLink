/**
 * SolveLink Citizen & Problem Interactions
 * Handles Leaflet interactive map, GPS geolocation, reverse geocoding, client-side validation, drag-and-drop image uploads, and AI analysis simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Interactive Leaflet Map & Geolocation
  // ==========================================
  const mapElem = document.getElementById('problemMap');
  const latInput = document.getElementById('latitudeInput');
  const lngInput = document.getElementById('longitudeInput');
  const locInput = document.getElementById('problemLocation');
  const locTextInput = document.getElementById('locationTextInput');
  const btnUseLocation = document.getElementById('btnUseCurrentLocation');
  const locationBtnText = document.getElementById('locationBtnText');
  const geoStatusText = document.getElementById('geoStatusText');
  const locError = document.getElementById('locationError');

  let map = null;
  let marker = null;
  let geocodeTimeout = null;

  // Custom SolveLink Burgundy Map Pin Icon
  const createPinIcon = () => {
    if (typeof L === 'undefined') return null;
    const pinSvg = `
      <svg width="28" height="36" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="#7B2340"/>
        <circle cx="12" cy="11" r="5" fill="#FAF9F7"/>
        <circle cx="12" cy="11" r="2.5" fill="#C28B38"/>
      </svg>
    `;
    return L.divIcon({
      className: 'solvelink-map-pin',
      html: pinSvg,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -32]
    });
  };

  // Reverse Geocoding using OpenStreetMap Nominatim with debouncing
  function reverseGeocode(lat, lng) {
    if (geocodeTimeout) clearTimeout(geocodeTimeout);

    if (geoStatusText) {
      geoStatusText.textContent = 'Resolving address...';
      geoStatusText.style.color = 'var(--color-text-muted)';
    }

    geocodeTimeout = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'en'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.display_name) {
            // Build a clean, readable location string
            const addr = data.address || {};
            const parts = [
              addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood,
              addr.city || addr.town || addr.village || addr.county || addr.district,
              addr.state,
              addr.postcode
            ].filter(Boolean);

            const formattedAddress = parts.length > 0 ? parts.join(', ') : data.display_name;

            if (locInput) {
              locInput.value = formattedAddress;
            }
            if (locTextInput) {
              locTextInput.value = formattedAddress;
            }

            if (geoStatusText) {
              geoStatusText.textContent = 'Address resolved';
              geoStatusText.style.color = 'var(--color-success)';
            }

            if (locInput) clearFieldError('location', locInput, locError);
          }
        } else {
          if (geoStatusText) {
            geoStatusText.textContent = 'Coordinates selected';
            geoStatusText.style.color = 'var(--color-primary)';
          }
        }
      } catch (err) {
        console.warn('[Geocoding Notice] Could not reverse geocode address:', err.message);
        if (geoStatusText) {
          geoStatusText.textContent = 'Coordinates selected';
          geoStatusText.style.color = 'var(--color-primary)';
        }
      }
    }, 450);
  }

  // Update Latitude & Longitude inputs and marker position
  function updatePosition(lat, lng, doGeocode = true) {
    const cleanLat = Number(lat).toFixed(6);
    const cleanLng = Number(lng).toFixed(6);

    if (latInput) latInput.value = cleanLat;
    if (lngInput) lngInput.value = cleanLng;

    if (marker) {
      marker.setLatLng([lat, lng]);
    }

    if (mapElem) mapElem.classList.remove('is-invalid');
    if (locInput) clearFieldError('location', locInput, locError);

    if (doGeocode) {
      reverseGeocode(lat, lng);
    }
  }

  // Initialize Map
  function initMap() {
    if (!mapElem || typeof L === 'undefined') return;

    // Check if initial coordinates already exist in inputs
    const initialLat = latInput && latInput.value ? parseFloat(latInput.value) : 23.3441;
    const initialLng = lngInput && lngInput.value ? parseFloat(lngInput.value) : 85.3096;
    const hasInitial = Boolean(latInput && latInput.value && lngInput && lngInput.value);

    // Initial center on coordinates with regional zoom
    map = L.map(mapElem, {
      center: [initialLat, initialLng],
      zoom: hasInitial ? 15 : 12,
      zoomControl: true
    });

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Add Draggable Marker
    const pinIcon = createPinIcon();
    marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: pinIcon || undefined
    }).addTo(map);

    if (hasInitial) {
      updatePosition(initialLat, initialLng, false);
    } else {
      // Prepopulate default coordinates so form is ready if user submits directly
      if (latInput && !latInput.value) latInput.value = initialLat.toFixed(6);
      if (lngInput && !lngInput.value) lngInput.value = initialLng.toFixed(6);
    }

    // 1. Drag Marker Event
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      updatePosition(pos.lat, pos.lng, true);
    });

    // 2. Click on Map Event
    map.on('click', (e) => {
      updatePosition(e.latlng.lat, e.latlng.lng, true);
    });

    // Handle map container resize cleanly
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 250);
  }

  if (mapElem) {
    initMap();
  }

  // "Use My Current Location" GPS Geolocation Button
  if (btnUseLocation) {
    btnUseLocation.addEventListener('click', (e) => {
      e.preventDefault();

      if (!navigator.geolocation) {
        if (geoStatusText) {
          geoStatusText.textContent = 'Geolocation is not supported by your browser. Please select manually on the map.';
          geoStatusText.style.color = 'var(--color-danger)';
        }
        return;
      }

      if (locationBtnText) locationBtnText.textContent = 'Getting your location...';
      if (geoStatusText) {
        geoStatusText.textContent = 'Detecting GPS position...';
        geoStatusText.style.color = 'var(--color-text-muted)';
      }
      btnUseLocation.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          if (locationBtnText) locationBtnText.textContent = 'Use My Current Location';
          if (geoStatusText) {
            geoStatusText.textContent = 'Location detected';
            geoStatusText.style.color = 'var(--color-success)';
          }
          btnUseLocation.disabled = false;

          if (map) {
            map.flyTo([lat, lng], 16, { animate: true, duration: 1 });
          }
          updatePosition(lat, lng, true);
        },
        (err) => {
          if (locationBtnText) locationBtnText.textContent = 'Use My Current Location';
          btnUseLocation.disabled = false;

          if (err.code === err.PERMISSION_DENIED) {
            if (geoStatusText) {
              geoStatusText.textContent = 'Location access was denied. You can select the location manually on the map.';
              geoStatusText.style.color = 'var(--color-danger)';
            }
          } else {
            if (geoStatusText) {
              geoStatusText.textContent = 'Unable to retrieve location. Please select on the map.';
              geoStatusText.style.color = 'var(--color-danger)';
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  // Sync manual input changes to hidden locationText field
  if (locInput && locTextInput) {
    locInput.addEventListener('input', () => {
      locTextInput.value = locInput.value;
      if (locInput.value.trim().length > 0) {
        clearFieldError('location', locInput, locError);
      }
    });
  }

  // ==========================================
  // 2. File Upload Dropzone & Previews
  // ==========================================
  const dropzone = document.getElementById('problemDropzone');
  const fileInput = document.getElementById('problemImages');
  const previewGrid = document.getElementById('imagePreviewGrid');
  const imagesError = document.getElementById('imagesError');

  // Maintain uploaded files list in memory
  let uploadedFiles = [];

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('.image-remove-btn')) return;
      fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        addFiles(fileInput.files);
        fileInput.value = '';
      }
    });
  }

  function addFiles(newFiles) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    Array.from(newFiles).forEach((file) => {
      if (uploadedFiles.length >= 5) {
        alert('Maximum of 5 photo evidence images allowed.');
        return;
      }

      if (!allowedTypes.includes(file.type.toLowerCase())) {
        alert(`"${file.name}" is not a supported format. Please upload JPEG, PNG, or WebP.`);
        return;
      }

      if (file.size > maxSizeBytes) {
        alert(`"${file.name}" exceeds the 5MB size limit.`);
        return;
      }

      const isDuplicate = uploadedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!isDuplicate) {
        uploadedFiles.push(file);
      }
    });

    renderPreviews();
    clearFieldError('images', dropzone, imagesError);
  }

  function renderPreviews() {
    if (!previewGrid) return;
    previewGrid.innerHTML = '';

    uploadedFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'image-preview-item';

      const img = document.createElement('img');
      img.alt = `Preview ${index + 1}`;

      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'image-remove-btn';
      removeBtn.title = 'Remove photo';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedFiles.splice(index, 1);
        renderPreviews();
      });

      item.appendChild(img);
      item.appendChild(removeBtn);
      previewGrid.appendChild(item);
    });
  }

  // ==========================================
  // 3. Clear & Show Validation Error Helpers
  // ==========================================
  function clearFieldError(type, element, errorElement) {
    if (element) element.classList.remove('is-invalid');
    if (errorElement) errorElement.style.display = 'none';
  }

  function showFieldError(element, errorElement) {
    if (element) element.classList.add('is-invalid');
    if (errorElement) errorElement.style.display = 'flex';
  }

  // Live error clearance on user interaction
  const titleInput = document.getElementById('problemTitle');
  const descInput = document.getElementById('problemDesc');
  const titleError = document.getElementById('titleError');
  const descError = document.getElementById('descError');
  const urgencyRadios = document.querySelectorAll('input[name="urgency"]');
  const urgencyError = document.getElementById('urgencyError');

  if (titleInput) {
    titleInput.addEventListener('input', () => {
      if (titleInput.value.trim().length > 0) clearFieldError('title', titleInput, titleError);
    });
  }

  if (descInput) {
    descInput.addEventListener('input', () => {
      if (descInput.value.trim().length > 0) clearFieldError('description', descInput, descError);
    });
  }

  if (urgencyRadios) {
    urgencyRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (urgencyError) urgencyError.style.display = 'none';
      });
    });
  }

  // ==========================================
  // 4. Report Form Submission with Coordinate Support
  // ==========================================
  const reportForm = document.getElementById('reportProblemForm');
  const aiModal = document.getElementById('aiProcessingModal');

  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      let hasErrors = false;
      let firstInvalidElement = null;

      // 1. Validate Title
      const titleVal = titleInput ? titleInput.value.trim() : '';
      if (!titleVal) {
        showFieldError(titleInput, titleError);
        hasErrors = true;
        if (!firstInvalidElement) firstInvalidElement = titleInput;
      } else {
        clearFieldError('title', titleInput, titleError);
      }

      // 2. Validate Location & Coordinates
      const locVal = locInput ? locInput.value.trim() : '';
      const latVal = latInput ? parseFloat(latInput.value) : NaN;
      const lngVal = lngInput ? parseFloat(lngInput.value) : NaN;

      const isLatValid = !isNaN(latVal) && latVal >= -90 && latVal <= 90;
      const isLngValid = !isNaN(lngVal) && lngVal >= -180 && lngVal <= 180;

      if (!locVal || !isLatValid || !isLngValid) {
        showFieldError(locInput, locError);
        if (mapElem) mapElem.classList.add('is-invalid');
        hasErrors = true;
        if (!firstInvalidElement) firstInvalidElement = locInput;
      } else {
        clearFieldError('location', locInput, locError);
        if (mapElem) mapElem.classList.remove('is-invalid');
      }

      // 3. Validate Description
      const descVal = descInput ? descInput.value.trim() : '';
      if (!descVal) {
        showFieldError(descInput, descError);
        hasErrors = true;
        if (!firstInvalidElement) firstInvalidElement = descInput;
      } else {
        clearFieldError('description', descInput, descError);
      }

      // 4. Validate Urgency
      const selectedUrgency = document.querySelector('input[name="urgency"]:checked');
      if (!selectedUrgency || !['LOW', 'MEDIUM', 'HIGH'].includes(selectedUrgency.value)) {
        if (urgencyError) urgencyError.style.display = 'flex';
        hasErrors = true;
        if (!firstInvalidElement) firstInvalidElement = document.getElementById('groupUrgency');
      } else {
        if (urgencyError) urgencyError.style.display = 'none';
      }

      // 5. Validate Photos (At least 1 required)
      if (uploadedFiles.length === 0) {
        showFieldError(dropzone, imagesError);
        hasErrors = true;
        if (!firstInvalidElement) firstInvalidElement = dropzone;
      } else {
        clearFieldError('images', dropzone, imagesError);
      }

      // If validation failed, focus & scroll to first error
      if (hasErrors) {
        if (firstInvalidElement) {
          firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof firstInvalidElement.focus === 'function') {
            firstInvalidElement.focus();
          }
        }
        return;
      }

      // If validation passed, activate AI Reasoning Modal
      if (aiModal) {
        aiModal.classList.add('active');
      }

      const steps = [
        document.getElementById('aiStep1'),
        document.getElementById('aiStep2'),
        document.getElementById('aiStep3'),
        document.getElementById('aiStep4')
      ];

      function advanceStep(index) {
        if (index > 0 && steps[index - 1]) {
          steps[index - 1].classList.remove('active');
          steps[index - 1].classList.add('done');
        }
        if (steps[index]) {
          steps[index].classList.add('active');
        }
      }

      advanceStep(0);
      const timer1 = setTimeout(() => advanceStep(1), 500);
      const timer2 = setTimeout(() => advanceStep(2), 1100);
      const timer3 = setTimeout(() => advanceStep(3), 1700);

      try {
        const formData = new FormData();
        formData.append('title', titleVal);
        formData.append('location', locVal);
        formData.append('locationText', locVal);
        formData.append('latitude', latVal);
        formData.append('longitude', lngVal);
        formData.append('description', descVal);

        const categorySelect = document.getElementById('optionalCategory');
        formData.append('optionalCategory', categorySelect ? categorySelect.value : '');

        if (selectedUrgency) {
          formData.append('urgency', selectedUrgency.value);
        }

        uploadedFiles.forEach((file) => {
          formData.append('images', file);
        });

        const response = await fetch('/citizen/report-problem', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);

        const data = await response.json();

        if (response.ok && data.success) {
          if (steps[3]) {
            steps[3].classList.remove('active');
            steps[3].classList.add('done');
          }
          
          setTimeout(() => {
            window.location.href = data.redirectUrl || `/problems/${data.problem._id}`;
          }, 400);
        } else {
          if (aiModal) aiModal.classList.remove('active');
          alert(data.error || 'Failed to submit problem report. Please check the form and try again.');
        }
      } catch (err) {
        if (aiModal) aiModal.classList.remove('active');
        console.error('Submission error:', err);
        alert('An unexpected network error occurred while submitting your report. Please try again.');
      }
    });
  }

  // ==========================================
  // 5. Upvote / Community Support AJAX Toggle
  // ==========================================
  const supportBtn = document.getElementById('btnSupportProblem');
  if (supportBtn) {
    supportBtn.addEventListener('click', async () => {
      const problemId = supportBtn.getAttribute('data-problem-id');
      if (!problemId) return;

      try {
        const response = await fetch(`/problems/${problemId}/support`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (response.status === 401) {
          window.location.href = `/auth/login?redirect=/problems/${problemId}&msg=login_required`;
          return;
        }

        const data = await response.json();
        if (data.success) {
          const countElem = document.getElementById('supporterCountText');
          if (countElem) {
            countElem.textContent = `${data.supporterCount} ${data.supporterCount === 1 ? 'Supporter' : 'Supporters'}`;
          }

          if (data.isSupported) {
            supportBtn.classList.add('supported');
            supportBtn.querySelector('.support-btn-label').textContent = '✓ Supported';
          } else {
            supportBtn.classList.remove('supported');
            supportBtn.querySelector('.support-btn-label').textContent = '👍 Support This Problem';
          }
        }
      } catch (err) {
        console.error('Support action error:', err);
      }
    });
  }

  // Support / Upvote Buttons on Problem Cards Grid
  document.querySelectorAll('.btn-card-support').forEach(cardBtn => {
    cardBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const problemId = cardBtn.getAttribute('data-problem-id');
      if (!problemId) return;

      cardBtn.disabled = true;

      try {
        const response = await fetch(`/problems/${problemId}/support`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (response.status === 401) {
          window.location.href = `/auth/login?redirect=/problems&msg=login_required`;
          return;
        }

        const data = await response.json();
        if (data.success) {
          const iconSpan = cardBtn.querySelector('.card-support-icon');
          const labelSpan = cardBtn.querySelector('.card-support-label');
          const indicatorElem = document.getElementById(`indicator-${problemId}`);

          if (data.isSupported) {
            cardBtn.classList.add('supported');
            if (iconSpan) iconSpan.textContent = '✓';
            if (labelSpan) labelSpan.textContent = 'Supported';
            if (indicatorElem) indicatorElem.classList.add('user-supported');
          } else {
            cardBtn.classList.remove('supported');
            if (iconSpan) iconSpan.textContent = '👍';
            if (labelSpan) labelSpan.textContent = 'Support';
            if (indicatorElem) indicatorElem.classList.remove('user-supported');
          }

          if (indicatorElem) {
            const countLabel = indicatorElem.querySelector('.supporter-count-label');
            if (countLabel) {
              countLabel.textContent = `${data.supporterCount} ${data.supporterCount === 1 ? 'supporter' : 'supporters'}`;
            }
          }
        }
      } catch (err) {
        console.error('Card support action error:', err);
      } finally {
        cardBtn.disabled = false;
      }
    });
  });

  // ==========================================
  // 6. Delete Report Confirmation Modal
  // ==========================================
  const btnOpenDeleteModal = document.getElementById('btnOpenDeleteModal');
  const deleteModal = document.getElementById('deleteReportModal');
  const btnCancelDeleteConfirm = document.getElementById('btnCancelDeleteConfirm');
  const btnConfirmDeleteReport = document.getElementById('btnConfirmDeleteReport');
  const btnConfirmDeleteText = document.getElementById('btnConfirmDeleteText');
  const deleteRequestError = document.getElementById('deleteRequestError');

  function resetDeleteModal() {
    if (deleteModal) {
      deleteModal.style.display = 'none';
      deleteModal.classList.remove('active');
    }
    if (deleteRequestError) {
      deleteRequestError.style.display = 'none';
      deleteRequestError.textContent = '';
    }
    if (btnConfirmDeleteReport) btnConfirmDeleteReport.disabled = false;
    if (btnConfirmDeleteText) btnConfirmDeleteText.textContent = 'Delete Report';
  }

  if (btnOpenDeleteModal && deleteModal) {
    btnOpenDeleteModal.addEventListener('click', () => {
      resetDeleteModal();
      deleteModal.style.display = 'flex';
      deleteModal.classList.add('active');
    });

    if (btnCancelDeleteConfirm) {
      btnCancelDeleteConfirm.addEventListener('click', resetDeleteModal);
    }

    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) resetDeleteModal();
    });

    if (btnConfirmDeleteReport) {
      btnConfirmDeleteReport.addEventListener('click', async () => {
        const problemId = btnOpenDeleteModal.getAttribute('data-problem-id');
        if (!problemId) return;

        if (deleteRequestError) deleteRequestError.style.display = 'none';
        if (btnConfirmDeleteText) btnConfirmDeleteText.textContent = 'Deleting...';
        btnConfirmDeleteReport.disabled = true;

        try {
          const response = await fetch(`/problems/${problemId}/delete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          const data = await response.json();

          if (response.ok && data.success) {
            if (btnConfirmDeleteText) btnConfirmDeleteText.textContent = 'Deleted!';
            setTimeout(() => {
              window.location.href = data.redirectUrl || '/citizen/my-problems';
            }, 300);
          } else {
            btnConfirmDeleteReport.disabled = false;
            if (btnConfirmDeleteText) btnConfirmDeleteText.textContent = 'Delete Report';
            if (deleteRequestError) {
              deleteRequestError.textContent = data.error || 'Failed to delete report. Please try again.';
              deleteRequestError.style.display = 'block';
            }
          }
        } catch (err) {
          console.error('Delete action error:', err);
          btnConfirmDeleteReport.disabled = false;
          if (btnConfirmDeleteText) btnConfirmDeleteText.textContent = 'Delete Report';
          if (deleteRequestError) {
            deleteRequestError.textContent = 'An unexpected network error occurred. Please try again.';
            deleteRequestError.style.display = 'block';
          }
        }
      });
    }
  }

  // ==========================================
  // 7. Realtime Pre-Submission Duplicate Checking (Report Problem Form)
  // ==========================================
  const dupContainer = document.getElementById('duplicateCheckContainer');
  const dupMatchesList = document.getElementById('duplicateMatchesList');
  const dupStatusText = document.getElementById('duplicateCheckStatus');
  const btnDismissDup = document.getElementById('btnDismissDuplicateCheck');

  if (dupContainer && dupMatchesList) {
    let dupCheckTimeout = null;

    const performDuplicateCheck = async () => {
      const titleVal = titleInput ? titleInput.value.trim() : '';
      const descVal = descInput ? descInput.value.trim() : '';
      const locVal = locInput ? locInput.value.trim() : '';
      const catVal = optCatSelect ? optCatSelect.value : '';

      if (titleVal.length < 5 && descVal.length < 15) {
        dupContainer.style.display = 'none';
        return;
      }

      if (dupStatusText) dupStatusText.textContent = 'Checking for similar problems...';

      try {
        const response = await fetch('/api/problems/check-duplicates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            title: titleVal,
            description: descVal,
            category: catVal,
            location: locVal
          })
        });

        const data = await response.json();
        if (data.success && data.duplicates && Array.isArray(data.duplicates.topMatches) && data.duplicates.topMatches.length > 0) {
          dupMatchesList.innerHTML = '';
          const matches = data.duplicates.topMatches;

          matches.forEach(item => {
            const prob = item.problem;
            const supporters = prob.supporters ? prob.supporters.length : 1;

            const card = document.createElement('div');
            card.className = 'duplicate-match-item';
            card.style.cssText = 'background: #FFFFFF; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap;';
            card.innerHTML = `
              <div style="flex: 1; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: 2px;">
                  <span class="badge badge-warning" style="font-size: 0.625rem;">${item.percentage}% similar</span>
                  <span class="badge badge-neutral" style="font-size: 0.625rem;">${prob.category || 'Civic'}</span>
                </div>
                <strong style="font-size: var(--font-size-xs); color: var(--color-text); display: block; line-height: 1.3;">${prob.title}</strong>
                <span style="font-size: 0.6875rem; color: var(--color-text-muted);">📍 ${prob.location} &bull; 👍 ${supporters} supporters</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <a href="/problems/${prob._id}" target="_blank" class="btn btn-ghost btn-sm" style="font-size: var(--font-size-xs); padding: 4px 8px;">View</a>
                <button type="button" class="btn btn-primary btn-sm btn-support-existing" data-prob-id="${prob._id}" style="font-size: var(--font-size-xs); padding: 4px 8px;">
                  Support Existing
                </button>
              </div>
            `;
            dupMatchesList.appendChild(card);
          });

          // Wire up Support Existing action
          dupMatchesList.querySelectorAll('.btn-support-existing').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
              ev.preventDefault();
              const probId = btn.getAttribute('data-prob-id');
              btn.disabled = true;
              btn.textContent = 'Supporting...';
              try {
                const sRes = await fetch(`/problems/${probId}/support`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
                });
                if (sRes.status === 401) {
                  window.location.href = `/auth/login?redirect=/problems/${probId}&msg=login_required`;
                  return;
                }
                window.location.href = `/problems/${probId}`;
              } catch (e) {
                console.error(e);
                window.location.href = `/problems/${probId}`;
              }
            });
          });

          dupContainer.style.display = 'block';
          if (dupStatusText) dupStatusText.textContent = `${matches.length} possible ${matches.length === 1 ? 'match' : 'matches'} found`;
        } else {
          dupContainer.style.display = 'none';
        }
      } catch (err) {
        console.warn('Duplicate check error:', err);
        dupContainer.style.display = 'none';
      }
    };

    const scheduleDupCheck = () => {
      clearTimeout(dupCheckTimeout);
      dupCheckTimeout = setTimeout(performDuplicateCheck, 400);
    };

    if (titleInput) titleInput.addEventListener('input', scheduleDupCheck);
    if (descInput) descInput.addEventListener('input', scheduleDupCheck);
    if (locInput) locInput.addEventListener('input', scheduleDupCheck);
    if (optCatSelect) optCatSelect.addEventListener('change', scheduleDupCheck);

    if (btnDismissDup) {
      btnDismissDup.addEventListener('click', () => {
        dupContainer.style.display = 'none';
      });
    }
  }

  // ==========================================
  // 8. Duplicate Report Linking Modal Handler (Problem Detail Page)
  // ==========================================
  const btnOpenDupModal = document.getElementById('btnOpenDuplicateModal');
  const dupModal = document.getElementById('linkDuplicateModal');
  const btnCancelDupModal = document.getElementById('btnCancelDuplicateModal');
  const linkDupForm = document.getElementById('linkDuplicateForm');
  const dupLinkError = document.getElementById('duplicateLinkError');
  const btnDupLinkText = document.getElementById('btnDuplicateLinkText');
  const btnSubmitDupLink = document.getElementById('btnSubmitDuplicateLink');

  if (btnOpenDupModal && dupModal) {
    btnOpenDupModal.addEventListener('click', () => {
      if (dupLinkError) dupLinkError.style.display = 'none';
      dupModal.style.display = 'flex';
      dupModal.classList.add('active');
    });

    if (btnCancelDupModal) {
      btnCancelDupModal.addEventListener('click', () => {
        dupModal.style.display = 'none';
        dupModal.classList.remove('active');
      });
    }

    dupModal.addEventListener('click', (e) => {
      if (e.target === dupModal) {
        dupModal.style.display = 'none';
        dupModal.classList.remove('active');
      }
    });

    if (linkDupForm) {
      linkDupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentProblemId = linkDupForm.getAttribute('data-current-problem-id');
        const targetProblemId = document.getElementById('targetDuplicateSelect')?.value;
        const note = document.getElementById('duplicateNoteInput')?.value;

        if (!targetProblemId) {
          if (dupLinkError) {
            dupLinkError.textContent = 'Please select a primary matching problem to link.';
            dupLinkError.style.display = 'block';
          }
          return;
        }

        if (btnDupLinkText) btnDupLinkText.textContent = 'Linking...';
        if (btnSubmitDupLink) btnSubmitDupLink.disabled = true;

        try {
          const response = await fetch(`/problems/${currentProblemId}/duplicate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ targetProblemId, note })
          });

          const data = await response.json();
          if (response.ok && data.success) {
            if (btnDupLinkText) btnDupLinkText.textContent = 'Linked!';
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else {
            if (btnSubmitDupLink) btnSubmitDupLink.disabled = false;
            if (btnDupLinkText) btnDupLinkText.textContent = 'Yes, Link as Similar';
            if (dupLinkError) {
              dupLinkError.textContent = data.error || 'Failed to link duplicate. Please try again.';
              dupLinkError.style.display = 'block';
            }
          }
        } catch (err) {
          console.error('Duplicate link submission error:', err);
          if (btnSubmitDupLink) btnSubmitDupLink.disabled = false;
          if (btnDupLinkText) btnDupLinkText.textContent = 'Yes, Link as Similar';
          if (dupLinkError) {
            dupLinkError.textContent = 'A network error occurred while linking duplicate report.';
            dupLinkError.style.display = 'block';
          }
        }
      });
    }
  }
});
