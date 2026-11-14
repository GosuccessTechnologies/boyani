import type { Metadata } from 'next';
import { getSiteSetting, getPublicDoctors } from '@/lib/public-data';
import { BreadcrumbHero } from '@/components/breadcrumbs/BreadcrumbDesigns';
import DoctorBrowser from './DoctorBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Our Doctors',
  description: 'Meet our specialist doctors — qualifications, experience, consultation fees and availability. Book online.',
};

export default async function DoctorsPage() {
  const [setting, doctors] = await Promise.all([
    getSiteSetting(),
    getPublicDoctors(200),
  ]);

  return (
    <>
      <BreadcrumbHero
        title="Our Doctors"
        subtitle="Specialists who know your name, not just your file number."
        items={[{ label: 'Doctors' }]}
        designId={setting?.activeBreadcrumbDesign || 1}
      />

      <section className="mc-section">
        <div className="mc-container">
          <DoctorBrowser
            doctors={doctors.map(d => ({
              id: d.id,
              name: d.name,
              title: d.title,
              specialization: d.specialization,
              department: d.department,
              qualifications: d.qualifications,
              experienceYears: d.experienceYears,
              consultationFee: d.consultationFee,
              availableDays: d.availableDays,
              availableHours: d.availableHours,
              isAcceptingPatients: d.isAcceptingPatients,
              photoUrl: d.photoUrl,
            }))}
          />
        </div>
      </section>
    </>
  );
}
