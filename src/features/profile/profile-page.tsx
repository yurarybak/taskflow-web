import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, Button, Field, Input, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { initials } from "../../lib/utils";

export function ProfilePage() {
  const [avatarVersion, setAvatarVersion] = useState(0);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: api.profile,
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const save = useMutation({
    mutationFn: () =>
      api.updateProfile({
        firstName: firstName || data?.firstName || "",
        lastName: lastName || data?.lastName || "",
      }),
    onSuccess: () => {
      refetch();
      toast.success("Profile updated");
    },
  });
  const change = useMutation({
    mutationFn: () => api.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed");
    },
  });
  const upload = useMutation({
    mutationFn: api.uploadAvatar,
    onSuccess: () => {
      refetch();
      setAvatarVersion((value) => value + 1);
      toast.success("Avatar uploaded");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: api.removeAvatar,
    onSuccess: () => {
      refetch();
      setAvatarVersion((value) => value + 1);
      toast.success("Avatar removed");
    },
  });
  if (isLoading || !data) return <Skeleton />;
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile settings</h1>
          <p>Manage your account details and security preferences.</p>
        </div>
      </header>
      <div className="settings-grid">
        <section className="settings-card">
          <h2>Profile</h2>
          <div className="avatar-settings">
            <label className="avatar-upload" aria-label="Change avatar">
              <Avatar
                label={initials(data)}
                src={`${api.avatarUrl(data.id)}?v=${avatarVersion}`}
              />
              <span className="avatar-overlay">
                <Camera size={18} />
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.currentTarget.value = "";
                  if (!file) return;
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    toast.error("Use a JPEG, PNG or WebP image.");
                    return;
                  }
                  upload.mutate(file);
                }}
              />
            </label>
            <div>
              <strong>{data.email}</strong>
              <small>
                Hover the avatar to upload a JPEG, PNG or WebP image.
              </small>
              <Button
                variant="ghost"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 size={14} /> Remove avatar
              </Button>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="form-grid">
              <Field label="First name">
                <Input
                  defaultValue={data.firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Last name">
                <Input
                  defaultValue={data.lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Email">
              <Input value={data.email} disabled />
            </Field>
            <Button loading={save.isPending}>Save profile</Button>
          </form>
        </section>
        <section className="settings-card">
          <h2>
            <KeyRound size={17} /> Password
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              change.mutate();
            }}
          >
            <Field label="Current password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
            <Button loading={change.isPending}>Change password</Button>
          </form>
        </section>
      </div>
    </>
  );
}
