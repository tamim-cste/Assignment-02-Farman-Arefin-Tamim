/* app.js — Frontend Logic */

const PRICE_PER_NIGHT = 2026;
const IMG_SERVICE_URL = 'https://beta.imgservice.rentbyowner.com/640x300/';
const LOCAL_IMG_BASE  = '/images/';
const FAVORITES_KEY   = 'resort_favorites';
const isMobile        = () => window.innerWidth <= 600;

let currentSort      = 'most-popular';
let galleryImages    = [];
let currentImgIdx    = 0;
let touchStartX      = 0;
let mapMarkers       = {};
let map              = null;
let activeInfoWindow = null;


/* Entry point — called by Google Maps callback  */
function initMap() {
  const mapEl = document.getElementById('nearby-map');
  if (!mapEl || typeof google === 'undefined') return;

  mapEl.style.minHeight = '620px';

  map = new google.maps.Map(mapEl, {
    zoom: 4,
    center: { lat: 20, lng: 0 },
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
}

function initAll() {
  initDatePicker();
  initGalleryModal();
  initMobileBannerSlider();
  initShowMore();
  initSortDropdown();
  loadNearbyProperties(currentSort);
}

/* THIS SECTION IS FOR DATE PICKER  */
function initDatePicker() {
  const checkinEl  = document.getElementById('checkin');
  const checkoutEl = document.getElementById('checkout');
  if (!checkinEl || !checkoutEl) return;

  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const fmt = d => d.toISOString().split('T')[0];

  // Set default values
  checkinEl.value  = fmt(today);
  checkoutEl.value = fmt(tomorrow);
  checkinEl.min    = fmt(today);
  checkoutEl.min   = fmt(tomorrow);


  // Show initial price immediately
  updateCartPrice(today, tomorrow);

  // Calendar icon → open native picker
  document.getElementById('checkin-icon')?.addEventListener('click', () => {
    try { checkinEl.showPicker(); } catch { checkinEl.focus(); }
  });
  document.getElementById('checkout-icon')?.addEventListener('click', () => {
    try { checkoutEl.showPicker(); } catch { checkoutEl.focus(); }
  });

  // This method will Auto-update price whenever either date changes
  function recalculate() {
    if (!checkinEl.value || !checkoutEl.value) return;
    const ci = new Date(checkinEl.value + 'T00:00:00');
    const co = new Date(checkoutEl.value + 'T00:00:00');
    if (co <= ci) {
      setAvailMsg('⚠️ Check-out must be after check-in', '#b45309');
      resetTotal();
      return;
    }
    updateCartPrice(ci, co);
  }

  // When check-in changes: push checkout min forward, recalculate
  checkinEl.addEventListener('change', () => {
    const ci   = new Date(checkinEl.value + 'T00:00:00');
    const next = new Date(ci);
    next.setDate(ci.getDate() + 1);
    checkoutEl.min = fmt(next);
    // If checkout is now invalid, fix it
    if (new Date(checkoutEl.value + 'T00:00:00') <= ci) {
      checkoutEl.value = fmt(next);
    }
    recalculate();
  });

  checkoutEl.addEventListener('change', recalculate);

  


  document.getElementById('btn-check-availability')?.addEventListener('click', () => {
    if (!checkinEl.value || !checkoutEl.value) {
      setAvailMsg('📅 Please select your dates first', '#b45309');
      return;
    }
    const ci = new Date(checkinEl.value + 'T00:00:00');
    const co = new Date(checkoutEl.value + 'T00:00:00');
    if (co <= ci) {
      setAvailMsg('⚠️ Check-out must be after check-in', '#b45309');
      return;
    }
    setAvailMsg(`✅ ${fmtDisplay(ci)} → ${fmtDisplay(co)}`, '#16a34a');
    updateCartPrice(ci, co);
  });
}

function fmtDisplay(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function setAvailMsg(msg, color) {
  const el = document.getElementById('dates-available');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
}

function resetTotal() {
  const tp = document.getElementById('total-price');
  if (tp) tp.textContent = '—';
}

function updateCartPrice(checkIn, checkOut) {
  const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  if (nights < 1) return;
  const total = nights * PRICE_PER_NIGHT;
  const el1 = document.getElementById('price-per-night');
  const el2 = document.getElementById('total-price');
  if (el1) el1.textContent = `USD $${PRICE_PER_NIGHT.toLocaleString()}`;
  if (el2) el2.textContent = `USD $${total.toLocaleString()}`;
  setAvailMsg(`✅ ${nights} night${nights > 1 ? 's' : ''} selected`, '#16a34a');
}

/* SHOW MORE / SHOW LESS */
function initShowMore() {
  const btn     = document.getElementById('show-more-btn');
  const fullEl  = document.getElementById('desc-full');
  if (!btn || !fullEl) return;

  let expanded = false;

  btn.addEventListener('click', e => {
    e.preventDefault();
    expanded = !expanded;
    if (expanded) {
      fullEl.classList.remove('desc-full-collapsed');
      fullEl.classList.add('desc-full-expanded');
      btn.textContent = 'Show less ▴';
    } else {
      fullEl.classList.remove('desc-full-expanded');
      fullEl.classList.add('desc-full-collapsed');
      btn.textContent = 'Show more ▾';
    }
  });
}


/* GALLERY MODAL */
function initGalleryModal() {
  const btn   = document.getElementById('view-all-images-btn');
  const modal = document.getElementById('gallery-modal');
  const close = document.getElementById('gallery-close');
  if (!modal) return;

  const openHandler = async () => {
    if (isMobile()) {
      // Mobile: show inline card slider instead of modal
      await loadGalleryImages();
      openMbs(galleryImages, 0);
      return;
    }
    await loadGalleryImages();
    openGalleryModal(0);
  };

  btn?.addEventListener('click', openHandler);
  close?.addEventListener('click', closeGalleryModal);
  // Click outside modal inner → close
  modal.addEventListener('click', e => { if (e.target === modal) closeGalleryModal(); });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closeGalleryModal();
  });

  // Touch swipe for mobile modal slider
  modal.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? nextImage() : prevImage();
  });

  document.getElementById('gallery-prev')?.addEventListener('click', prevImage);
  document.getElementById('gallery-next')?.addEventListener('click', nextImage);
}

async function loadGalleryImages() {
  if (galleryImages.length) return; // If already loaded
  try {
    const res = await fetch('/images');
    galleryImages = await res.json();
  } catch { galleryImages = []; }
  if (!galleryImages.length)
    galleryImages = Array.from({ length: 10 }, (_, i) =>
      `https://picsum.photos/seed/${i + 20}/900/600`);
}

function openGalleryModal(idx) {
  currentImgIdx = idx;
  document.getElementById('gallery-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderGallery();
}
function closeGalleryModal() {
  document.getElementById('gallery-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderGallery() {
  const grid   = document.getElementById('gallery-grid');
  const slider = document.getElementById('gallery-slider');

  if (isMobile()) {
    // Mobile: fullscreen carousel
    if (grid)   grid.style.display   = 'none';
    if (slider) slider.style.display = 'flex';
    const img = document.getElementById('gallery-slide-img');
    if (img) {
      img.style.opacity = '0';
      img.src = galleryImages[currentImgIdx];
      img.onload = () => { img.style.opacity = '1'; };
    }
    const counter = document.getElementById('gallery-counter');
    if (counter) counter.textContent = `${currentImgIdx + 1} / ${galleryImages.length}`;
    const dotsEl = document.getElementById('gallery-dots');
    if (dotsEl) {
      dotsEl.innerHTML = galleryImages.map((_, i) =>
        `<span class="dot ${i === currentImgIdx ? 'active' : ''}" data-idx="${i}"></span>`
      ).join('');
      dotsEl.querySelectorAll('.dot').forEach(d =>
        d.addEventListener('click', () => { currentImgIdx = parseInt(d.dataset.idx); renderGallery(); })
      );
    }
  } else {
    // Desktop: vertical grid — 1 landscape first, then 2-col pairs
    if (slider) slider.style.display = 'none';
    if (grid) {
      grid.style.display = 'flex';

      let html = '';
      const imgs = galleryImages;

      // First image: full-width landscape
      if (imgs[0]) {
        html += `<div class="gallery-row-landscape" data-idx="0">
          <img src="${imgs[0]}" alt="Image 1" loading="eager" />
        </div>`;
      }

      // Remaining images in 2-col pairs
      for (let i = 1; i < imgs.length; i += 2) {
        html += `<div class="gallery-row-pair">`;
        html += `<div class="gallery-pair-item" data-idx="${i}">
          <img src="${imgs[i]}" alt="Image ${i + 1}" loading="lazy" />
        </div>`;
        if (imgs[i + 1]) {
          html += `<div class="gallery-pair-item" data-idx="${i + 1}">
            <img src="${imgs[i + 1]}" alt="Image ${i + 2}" loading="lazy" />
          </div>`;
        }
        html += `</div>`;
      }

      grid.innerHTML = html;

  
      grid.querySelectorAll('[data-idx]').forEach(el =>
        el.addEventListener('click', () => {
          currentImgIdx = parseInt(el.dataset.idx);
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
      );

      // Scroll to active image on open
      setTimeout(() => {
        const active = grid.querySelector(`[data-idx="${currentImgIdx}"]`);
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }
}

function nextImage() {
  currentImgIdx = (currentImgIdx + 1) % galleryImages.length;
  renderGallery();
}
function prevImage() {
  currentImgIdx = (currentImgIdx - 1 + galleryImages.length) % galleryImages.length;
  renderGallery();
}

/* MOBILE BANNER SLIDER */
let mbsImages     = [];
let mbsIdx        = 0;
let mbsTouchStart = 0;

function initMobileBannerSlider() {
  const slider  = document.getElementById('mobile-banner-slider');
  if (!slider) return;

  document.getElementById('mbs-close')?.addEventListener('click', closeMbs);
  document.getElementById('mbs-prev')?.addEventListener('click', () => { mbsIdx = (mbsIdx - 1 + mbsImages.length) % mbsImages.length; renderMbs(); });
  document.getElementById('mbs-next')?.addEventListener('click', () => { mbsIdx = (mbsIdx + 1) % mbsImages.length; renderMbs(); });

  slider.addEventListener('touchstart', e => { mbsTouchStart = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', e => {
    const diff = mbsTouchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      mbsIdx = diff > 0
        ? (mbsIdx + 1) % mbsImages.length
        : (mbsIdx - 1 + mbsImages.length) % mbsImages.length;
      renderMbs();
    }
  });
}

function openMbs(images, startIdx) {
  mbsImages = images;
  mbsIdx    = startIdx || 0;
  const slider = document.getElementById('mobile-banner-slider');
  if (slider) {
    slider.style.display = 'flex';
    renderMbs();
    slider.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeMbs() {
  const slider = document.getElementById('mobile-banner-slider');
  if (slider) slider.style.display = 'none';
}

function renderMbs() {
  const img     = document.getElementById('mbs-img');
  const counter = document.getElementById('mbs-counter');
  const dots    = document.getElementById('mbs-dots');
  if (img) {
    img.style.opacity = '0';
    img.src = mbsImages[mbsIdx];
    img.onload = () => { img.style.opacity = '1'; };
  }
  if (counter) counter.textContent = `${mbsIdx + 1} / ${mbsImages.length}`;
  if (dots) {
    dots.innerHTML = mbsImages.map((_, i) =>
      `<span class="mbs-dot ${i === mbsIdx ? 'active' : ''}" data-i="${i}"></span>`
    ).join('');
    dots.querySelectorAll('.mbs-dot').forEach(d =>
      d.addEventListener('click', () => { mbsIdx = parseInt(d.dataset.i); renderMbs(); })
    );
  }
}


/* SORT DROPDOWN */
function initSortDropdown() {
  const select = document.getElementById('sort-select');
  if (!select) return;
  select.value = 'most-popular';
  select.addEventListener('change', () => {
    currentSort = select.value;
    loadNearbyProperties(currentSort);
  });
}


/* NEARBY PROPERTIES — API , Structure and Cards */
async function loadNearbyProperties(sort) {
  const limit     = isMobile() ? 4 : 6;
  const params    = new URLSearchParams({ [sort]: 'true', limit });
  const container = document.getElementById('nearby-cards');
  if (!container) return;

  container.innerHTML = Array(limit).fill(`
    <div class="resort-card skeleton">
      <div class="skeleton-img"></div>
      <div class="resort-card-body">
        <div class="skeleton-line w80"></div>
        <div class="skeleton-line w60"></div>
        <div class="skeleton-line w40"></div>
        <div class="skeleton-line w70"></div>
      </div>
    </div>`).join('');

  try {
    const res  = await fetch(`/get-property?${params}`);
    const data = await res.json();
    renderCards(data.items || []);
    if (map) renderMapMarkers(data.items || []);
  } catch (err) {
    container.innerHTML = `<p class="error-msg">❌ Failed to load properties. Please try again.</p>`;
    console.error('API error:', err);
  }
}

function renderCards(items) {
  const container = document.getElementById('nearby-cards');
  const favorites = getFavorites();
  if (!items.length) {
    container.innerHTML = `<p class="error-msg">No properties found.</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const prop    = item.Property || {};
    const geo     = item.GeoInfo  || {};
    const partner = item.Partner  || {};
    const counts  = prop.Counts   || {};
    const id      = item.ID       || '';
    const name    = prop.PropertyName || 'Property Name';
    const price   = prop.Price || prop.CachePrice || 0;
    const imgFile = prop.FeatureImage || '';
    const imgSrc  = imgFile
      ? `${IMG_SERVICE_URL}${imgFile}`
      : `${LOCAL_IMG_BASE}image${(parseInt(id.split('-').pop()) % 10) + 1}.jpg`;
    const isFav   = favorites.includes(id);
    const amenities = (prop.TopAmenities || []).slice(0, 3).map(a => a.Name).join(' · ')
                      || 'Air Conditioner · Balcony/Terrace';

    return `
      <div class="resort-card" data-id="${id}" data-lat="${geo.Lat || ''}" data-lng="${geo.Lng || ''}">
        <div class="resort-card-img">
          <img src="${imgSrc}" alt="${name}" loading="lazy"
               onerror="this.src='${LOCAL_IMG_BASE}image1.jpg'" />
          <span class="price-badge">From $${Number(price).toLocaleString()}</span>
          <div class="card-actions">
            <button class="action-btn fav-btn ${isFav ? 'active' : ''}" data-id="${id}"
                    title="Save to favourites" onclick="toggleFavorite(this,'${id}')">
              <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
            </button>
          </div>
        </div>
        <div class="resort-card-body">
          <div class="card-top-row">
            <span class="card-rating">★ ${prop.ReviewScore || 0} (${counts.Reviews || 0} Reviews)</span>
            <span class="card-type">${prop.PropertyType || 'Villa'}</span>
          </div>
          <h4 class="card-title">${name}</h4>
          <p class="card-amenities">${amenities}</p>
          <p class="card-location">${[geo.City, geo.Country].filter(Boolean).join(', ')}</p>
          <div class="card-footer-row">
            <span class="card-beds">🛏 ${counts.Bedroom || 0} Beds · 🚿 ${counts.Bathroom || 0} Baths</span>
            <a href="${partner.URL || '#'}" target="_blank" rel="noopener" class="btn-availability">View Availability</a>
          </div>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.resort-card').forEach(card => {
    card.addEventListener('mouseenter', () => highlightMarker(card.dataset.id, true));
    card.addEventListener('mouseleave', () => highlightMarker(card.dataset.id, false));
  });

  if (map) renderMapMarkers(items);
}

/* FAVORITES */
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch { return []; }
}
function saveFavorites(favs) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs)); }
function toggleFavorite(btn, id) {
  const favs = getFavorites();
  const idx  = favs.indexOf(id);
  if (idx === -1) {
    favs.push(id);
    btn.classList.add('active');
    btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
  } else {
    favs.splice(idx, 1);
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
  }
  saveFavorites(favs);
}

/* This section is for MAP Marker */
function renderMapMarkers(items) {
  if (!map) return;

  Object.values(mapMarkers).forEach(m => m.setMap(null));
  mapMarkers = {};
  if (activeInfoWindow) { activeInfoWindow.close(); activeInfoWindow = null; }

  const valid = items.filter(i =>
    !isNaN(parseFloat(i.GeoInfo?.Lat)) && !isNaN(parseFloat(i.GeoInfo?.Lng))
  );
  if (!valid.length) return;

  const bounds = new google.maps.LatLngBounds();

  valid.forEach(item => {
    const id    = item.ID;
    const lat   = parseFloat(item.GeoInfo.Lat);
    const lng   = parseFloat(item.GeoInfo.Lng);
    const price = item.Property?.Price || item.Property?.CachePrice || '';
    const name  = item.Property?.PropertyName || 'Property';

    const makeSvg = (fill, w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>
          <filter id="ds" x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.35)"/>
          </filter>
        </defs>
        <path d="M${w/2} 1 C${w*0.22} 1 1 ${h*0.22} 1 ${h*0.44}
                 C1 ${h*0.7} ${w/2} ${h-1} ${w/2} ${h-1}
                 C${w/2} ${h-1} ${w-1} ${h*0.7} ${w-1} ${h*0.44}
                 C${w-1} ${h*0.22} ${w*0.78} 1 ${w/2} 1Z"
              fill="${fill}" filter="url(#ds)"/>
        <circle cx="${w/2}" cy="${h*0.44}" r="${w*0.25}" fill="white"/>
        <circle cx="${w/2}" cy="${h*0.44}" r="${w*0.12}" fill="${fill}"/>
      </svg>`;

    const encode = s => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(s);

    const normalIcon = {
      url: encode(makeSvg('#5b21b6', 32, 44)),
      scaledSize: new google.maps.Size(32, 44),
      anchor: new google.maps.Point(16, 44),
    };
    const hoverIcon = {
      url: encode(makeSvg('#3b0764', 40, 54)),
      scaledSize: new google.maps.Size(40, 54),
      anchor: new google.maps.Point(20, 54),
    };

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: name,
      icon:  normalIcon,
      zIndex: 1,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-family:sans-serif;padding:4px 6px;min-width:140px;">
          <strong style="font-size:13px;">${name}</strong><br/>
          <span style="color:#5b21b6;font-weight:bold;">$${price}/night</span>
        </div>`
    });

    marker.addListener('click', () => {
      if (activeInfoWindow) activeInfoWindow.close();
      infoWindow.open(map, marker);
      activeInfoWindow = infoWindow;
      const card = document.querySelector(`.resort-card[data-id="${id}"]`);
      if (card) {
        card.classList.add('highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => card.classList.remove('highlighted'), 2000);
      }
    });

    marker._normalIcon = normalIcon;
    marker._hoverIcon  = hoverIcon;
    mapMarkers[id] = marker;
    bounds.extend({ lat, lng });
  });

  map.fitBounds(bounds);
}

function highlightMarker(id, on) {
  const marker = mapMarkers[id];
  if (!marker) return;
  marker.setIcon(on ? marker._hoverIcon : marker._normalIcon);
  marker.setZIndex(on ? 999 : 1);
}