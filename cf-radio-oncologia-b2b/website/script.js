document.addEventListener('DOMContentLoaded', () => {
	const yearEl = document.getElementById('year');
	if (yearEl) {
		yearEl.textContent = new Date().getFullYear().toString();
	}

	const form = document.getElementById('contact-form');
	if (form) {
		const statusEl = document.getElementById('form-status');
		const submitBtn = document.getElementById('submit-btn');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const fd = new FormData(form);
			const payload = {
				name: fd.get('name')?.toString().trim() || '',
				email: fd.get('email')?.toString().trim() || '',
				subject: fd.get('subject')?.toString().trim() || '',
				message: fd.get('message')?.toString().trim() || '',
				organization: fd.get('organization')?.toString().trim() || ''
			};
			statusEl.textContent = 'A enviar…';
			submitBtn.setAttribute('disabled', 'true');
			try {
				const res = await fetch('/api/contact', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok) {
					statusEl.textContent = 'Mensagem enviada com sucesso.';
					form.reset();
				} else if (res.status === 400) {
					statusEl.textContent = 'Por favor verifique os campos.';
				} else {
					statusEl.textContent = 'Ocorreu um erro. Tente novamente.';
				}
			} catch (err) {
				statusEl.textContent = 'Sem ligação. Tente novamente.';
			} finally {
				submitBtn.removeAttribute('disabled');
			}
		});
	}
});