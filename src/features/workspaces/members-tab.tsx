import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Input,
  Select,
  Skeleton,
} from "../../components/ui";
import { api } from "../../lib/api";
import { keys } from "../../lib/query-keys";
import { initials, personName } from "../../lib/utils";
import type { Member, Role } from "../../lib/types";
import { useInvalidate } from "./workspace-utils";

export function MembersTab({ workspaceId }: { workspaceId: string }) {
  const invalidate = useInvalidate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const { data, isLoading } = useQuery({
    queryKey: keys.members(workspaceId),
    queryFn: () => api.members(workspaceId),
  });
  const refresh = () => invalidate(keys.members(workspaceId));
  const add = useMutation({
    mutationFn: () => api.addMember(workspaceId, { email, role }),
    onSuccess: () => {
      setEmail("");
      void refresh();
      toast.success("Member added");
    },
  });
  const [removeMember, setRemoveMember] = useState<Member>();
  const remove = useMutation({
    mutationFn: (id: string) => api.removeMember(workspaceId, id),
    onSuccess: () => {
      void refresh();
      setRemoveMember(undefined);
      toast.success("Member removed");
    },
  });
  const update = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.updateMember(workspaceId, id, role),
    onSuccess: refresh,
  });
  return (
    <>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input
          placeholder="Teammate email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option>MEMBER</option>
          <option>ADMIN</option>
        </Select>
        <Button loading={add.isPending}>
          <Plus size={15} /> Add member
        </Button>
      </form>
      {isLoading ? (
        <Skeleton />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.map((member: Member) => (
                <tr key={member.id}>
                  <td>
                    <div className="member-cell">
                      <Avatar
                        label={initials(member.user)}
                        src={api.avatarUrl(member.user.id)}
                      />
                      <span>
                        <strong>{personName(member.user)}</strong>
                        <small>{member.user.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <Select
                      aria-label={`Role for ${member.user.email}`}
                      value={member.role}
                      disabled={member.role === "OWNER"}
                      onChange={(e) =>
                        update.mutate({ id: member.id, role: e.target.value })
                      }
                    >
                      <option>OWNER</option>
                      <option>ADMIN</option>
                      <option>MEMBER</option>
                    </Select>
                  </td>
                  <td>
                    {member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        aria-label={`Remove ${member.user.email}`}
                        onClick={() => setRemoveMember(member)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={!!removeMember}
        title="Remove member?"
        description={`${removeMember ? personName(removeMember.user) : ""} will lose access to this workspace.`}
        confirmText="Remove"
        loading={remove.isPending}
        onConfirm={() => removeMember && remove.mutate(removeMember.id)}
        onClose={() => setRemoveMember(undefined)}
      />
    </>
  );
}
