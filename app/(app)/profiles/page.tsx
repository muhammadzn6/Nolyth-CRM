import { PageHeader } from "@/components/layout/page-header";
import { ProfileCard } from "@/components/profiles/profile-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveUser } from "@/lib/auth/session";
import { listAccessibleProfiles } from "@/services/profile-service";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const actor = await requireActiveUser();
  const profiles = await listAccessibleProfiles(actor);

  return (
    <div className="space-y-6">
      <PageHeader title="Profiles" />

      {profiles.length === 0 ? (
        <EmptyState
          title="No profiles yet"
          description="Seed data or create profiles through the admin API to populate this workspace."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile._id.toString()}
              profileId={profile._id.toString()}
              name={profile.name}
              createdAt={profile.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
