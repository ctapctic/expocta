    document.addEventListener('DOMContentLoaded', async () => {
      try {
        const res = await fetch('/api/valoraciones/stats');
        const data = await res.json();
        if (data.success && data.topProyectos) {
          const container = document.getElementById('top-proyectos-home');
          container.innerHTML = data.topProyectos.slice(0, 3).map(p => `
            <div class="col-md-4 mb-3">
              <div class="card card-custom h-100">
                <div class="card-img-wrapper">
                  <img src="${p.imagen_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'}" alt="${p.titulo}">
                  <span class="stand-badge">${p.codigo_stand}</span>
                </div>
                <div class="card-body">
                  <span class="badge bg-primary-subtle text-primary mb-2">${p.especialidad}</span>
                  <h5 class="fw-bold text-dark">${p.titulo}</h5>
                  <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    <span class="badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>${p.promedio_general} / 5</span>
                    <a href="evaluar.html?stand=${encodeURIComponent(p.codigo_stand)}" class="btn btn-sm btn-primary rounded-pill fw-bold">Evaluar</a>
                  </div>
                </div>
              </div>
            </div>
          `).join('');
        }
      } catch (e) {
        console.log('Stats home load fallback', e);
      }
    });
