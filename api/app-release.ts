type ReleaseManifest = {
  latestVersion: string;
  releasedAt: string;
  notes: { ar: string[]; fr: string[] };
  forceUpdate: boolean;
};

const release: ReleaseManifest = {
  latestVersion: '0.1.1',
  releasedAt: '2026-10-10',
  forceUpdate: false,
  notes: {
    ar: [
      'إضافة مركز آخر التحديثات والتحقق من الإصدار عند تشغيل التطبيق.',
      'تحسينات في تقييم سلامة الكاياك عند الرياح والهبات والموج.',
      'إضافة اختبارات آلية لحالات البحر الخطرة والبيانات الناقصة.',
      'تحسين عرض وحدات سرعة الرياح والتيارات.'
    ],
    fr: [
      'Ajout du centre des nouveautés et vérification de version au démarrage.',
      'Amélioration de l’évaluation de sécurité du kayak face au vent, aux rafales et aux vagues.',
      'Ajout de tests automatisés pour les conditions marines dangereuses et les données manquantes.',
      'Correction des unités d’affichage du vent et des courants.'
    ]
  }
};

export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json(release);
}
