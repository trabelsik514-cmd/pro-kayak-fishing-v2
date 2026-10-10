const APP_VERSION = '0.1.1';
const RELEASE_ENDPOINT = 'https://pro-kayak-fishing-v2.vercel.app/api/app-release';
const RELEASES_URL = 'https://github.com/trabelsik514-cmd/pro-kayak-fishing-v2/actions';

type Release = {
  latestVersion: string;
  releasedAt: string;
  notes: { ar: string[]; fr: string[] };
  forceUpdate?: boolean;
};

const isNewer = (remote: string, local: string): boolean => {
  const a = remote.split('.').map(v => Number.parseInt(v, 10) || 0);
  const b = local.split('.').map(v => Number.parseInt(v, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
};

const esc = (value: string): string => value.replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch] ?? ch));

export function initUpdateManager(root: HTMLElement): void {
  const french = () => document.documentElement.lang.toLowerCase().startsWith('fr');
  const text = (ar: string, fr: string) => french() ? fr : ar;

  // Keep the update entry compact so it never covers the map or sea data.
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'pkf-updates-button';
  button.className = 'pkf-updates-button';
  button.innerHTML = '<span class="pkf-updates-bell" aria-hidden="true">♧</span><span class="pkf-updates-dot" aria-hidden="true"></span>';
  button.querySelector('.pkf-updates-bell')!.textContent = '🔔';
  button.setAttribute('aria-label', text('آخر التحديثات', 'Dernières nouveautés'));
  button.title = text('آخر التحديثات', 'Dernières nouveautés');
  // Keep update notifications in the header, never over map pins or sea labels.
  const topbar = root.querySelector<HTMLElement>('.topbar');
  const languageButton = topbar?.querySelector<HTMLElement>('#lang-toggle');
  if (topbar && languageButton) {
    languageButton.insertAdjacentElement('afterend', button);
  } else if (topbar) {
    topbar.append(button);
  }
  button.style.position = 'relative';
  button.style.inset = 'auto';
  button.style.zIndex = '2';
  button.style.flex = '0 0 38px';
  button.style.width = '38px';
  button.style.height = '38px';
  button.style.borderRadius = '12px';
  button.style.background = 'rgba(5,18,28,.06)';
  button.style.border = '1px solid rgba(23,68,94,.18)';
  button.style.color = '#17445e';
  button.style.boxShadow = 'none';

  const dialog = document.createElement('section');
  dialog.className = 'pkf-updates-dialog hidden';
  dialog.id = 'pkf-updates-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'pkf-updates-title');
  dialog.innerHTML = `
    <div class="pkf-updates-card">
      <div class="pkf-updates-head">
        <div><small>PRO KAYAK FISHING V2</small><h2 id="pkf-updates-title">${text('آخر التحديثات','Dernières nouveautés')}</h2></div>
        <button type="button" class="pkf-updates-close" aria-label="${text('إغلاق','Fermer')}">×</button>
      </div>
      <p class="pkf-updates-status" id="pkf-updates-status">${text('رقم النسخة المثبتة','Version installée')}: <b>${APP_VERSION}</b></p>
      <div id="pkf-updates-content"><p>${text('جاري التحقق من التحديثات…','Vérification des mises à jour…')}</p></div>
      <p class="pkf-updates-footnote">${text('تحديثات الواجهة لا تتطلب دائماً إعادة التثبيت. أمّا تحديث APK فيلزم تنزيل النسخة الجديدة وتثبيتها.','Les mises à jour de l’interface ne nécessitent pas toujours une réinstallation. Une nouvelle APK doit être téléchargée et installée.')}</p>
    </div>`;
  root.append(dialog);

  const content = dialog.querySelector<HTMLElement>('#pkf-updates-content')!;
  const status = dialog.querySelector<HTMLElement>('#pkf-updates-status')!;
  const close = () => dialog.classList.add('hidden');
  button.addEventListener('click', () => {
    dialog.classList.remove('hidden');
    void refresh(true);
  });
  dialog.querySelector('.pkf-updates-close')?.addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  let lastRelease: Release | null = null;
  let checked = false;
  let lastCheckedAt: Date | null = null;

  const renderRelease = (release: Release, updateAvailable: boolean) => {
    const notes = release.notes?.[french() ? 'fr' : 'ar'] ?? [];
    const date = new Date(release.releasedAt);
    const dateText = Number.isNaN(date.getTime()) ? release.releasedAt : date.toLocaleDateString(french() ? 'fr-FR' : 'ar-TN');
    const checkedText = lastCheckedAt
      ? lastCheckedAt.toLocaleTimeString(french() ? 'fr-FR' : 'ar-TN', {hour:'2-digit',minute:'2-digit',hour12:false})
      : '—';
    status.innerHTML = `${text('النسخة المثبتة','Version installée')}: <b>${APP_VERSION}</b> · ${text('أحدث نسخة','Dernière version')}: <b>${esc(release.latestVersion)}</b>`;
    content.innerHTML = `
      ${updateAvailable ? `<div class="pkf-update-alert">${text('🆕 توجد نسخة أحدث. للحصول على تغييرات الكود داخل APK، نزّل النسخة الجديدة وثبّتها.','🆕 Une nouvelle version est disponible. Pour intégrer les changements dans l’APK, téléchargez et installez la nouvelle version.')}</div>` : `<div class="pkf-update-current">${text('✓ تطبيقك على آخر نسخة معلنة.','✓ Votre application est à jour selon la version publiée.')}</div>`}
      <p class="pkf-updates-date">${text('تاريخ الإصدار','Date de sortie')}: ${esc(dateText)}</p>
      <p class="pkf-updates-date">${text('آخر تحقق','Dernière vérification')}: <b>${esc(checkedText)}</b></p>
      <h3>${text('شنوّة تبدّل؟','Quoi de neuf ?')}</h3>
      ${notes.length ? '<ul>' + notes.map(note => '<li>' + esc(note) + '</li>').join('') + '</ul>' : `<p>${text('لا توجد تفاصيل إضافية حالياً.','Aucun détail supplémentaire pour le moment.')}</p>`}
      ${updateAvailable ? `<a class="pkf-updates-link" href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">${text('فتح صفحة تنزيلات المشروع','Ouvrir les téléchargements du projet')} ↗</a>` : ''}
      <button type="button" class="pkf-updates-retry pkf-updates-refresh">${text('التحقق الآن','Vérifier maintenant')}</button>
    `;
    content.querySelector('.pkf-updates-refresh')?.addEventListener('click', () => { checked = false; void refresh(true); });
  };

  async function refresh(showDialog: boolean): Promise<void> {
    if (showDialog) dialog.classList.remove('hidden');
    if (checked && lastRelease) {
      renderRelease(lastRelease, isNewer(lastRelease.latestVersion, APP_VERSION));
      return;
    }
    content.innerHTML = `<p>${text('جاري التحقق من التحديثات…','Vérification des mises à jour…')}</p>`;
    try {
      const response = await fetch(RELEASE_ENDPOINT, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('release endpoint returned ' + response.status);
      const release = await response.json() as Release;
      if (!release.latestVersion || !Array.isArray(release.notes?.ar) || !Array.isArray(release.notes?.fr)) {
        throw new Error('invalid release manifest');
      }
      lastRelease = release;
      checked = true;
      lastCheckedAt = new Date();
      const updateAvailable = isNewer(release.latestVersion, APP_VERSION);
      renderRelease(release, updateAvailable);
      button.classList.toggle('has-update', updateAvailable);
      button.setAttribute('aria-label', updateAvailable
        ? text('تحديث جديد متوفر','Nouvelle version disponible')
        : text('آخر التحديثات','Dernières nouveautés'));
      button.title = button.getAttribute('aria-label') || '';
      if (updateAvailable && localStorage.getItem('pkf-last-notified-version') !== release.latestVersion) {
        localStorage.setItem('pkf-last-notified-version', release.latestVersion);
        button.classList.add('has-update');
        if (!showDialog) dialog.classList.remove('hidden');
      }
    } catch (error) {
      console.warn('PKF release check failed', error);
      content.innerHTML = `<p class="pkf-updates-error">${text('تعذر الاتصال بخدمة التحديثات. جرّب مرة أخرى عند توفر الإنترنت.','Impossible de joindre le service de mise à jour. Réessayez lorsque la connexion sera disponible.')}</p><button type="button" class="pkf-updates-retry">${text('إعادة المحاولة','Réessayer')}</button>`;
      content.querySelector('.pkf-updates-retry')?.addEventListener('click', () => { checked = false; void refresh(true); });
    }
  }

  // Check quietly at startup; only indicate a new version with a tiny dot.
  void refresh(false);
}
