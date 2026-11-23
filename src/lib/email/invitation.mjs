/** @param {string} value */
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

/** @param {{ family: string, title: string, content: string | null, link: string }} options */
export function invitationEmail({ family, title, content, link }) {
  const greeting = `Hola, familia ${family}`;
  const safeContent = content ? `<p style="white-space:pre-wrap">${escapeHtml(content)}</p>` : "";
  return {
    subject: `Invitación: ${title}`,
    text: `${greeting}\n\n${title}${content ? `\n\n${content}` : ""}\n\nConfirma tu asistencia y consulta la lista de regalos: ${link}`,
    html: `<p>${escapeHtml(greeting)}</p><h1>${escapeHtml(title)}</h1><img src="cid:invitacion" alt="Invitación" style="width:100%;max-width:600px;height:auto">${safeContent}<p><a href="${escapeHtml(link)}">Confirma tu asistencia y consulta la lista de regalos</a></p>`,
  };
}
