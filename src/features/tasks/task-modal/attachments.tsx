import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Paperclip, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, ConfirmDialog } from "../../../components/ui";
import { api } from "../../../lib/api";
import { keys } from "../../../lib/query-keys";
import type { Attachment } from "../../../lib/types";

export function Attachments({ taskId }: { taskId: string }) {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: keys.attachments(taskId),
    queryFn: () => api.attachments(taskId),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: keys.attachments(taskId) });
  const [deleteAttachment, setDeleteAttachment] = useState<Attachment>();
  const remove = useMutation({
    mutationFn: (id: string) => api.removeAttachment(taskId, id),
    onSuccess: () => {
      void refresh();
      setDeleteAttachment(undefined);
      toast.success("Attachment deleted");
    },
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAttachment(taskId, file),
    onSuccess: refresh,
  });
  return (
    <section>
      <h3>
        <Paperclip size={15} /> Attachments
      </h3>
      <div className="attachment-list">
        {data?.map((file) => (
          <div className="attachment" key={file.id}>
            <a href={api.attachmentUrl(taskId, file.id)}>
              <Download size={14} /> {file.originalName}
            </a>
            <small>{Math.ceil(file.size / 1024)} KB</small>
            <Button
              variant="ghost"
              aria-label={`Delete ${file.originalName}`}
              onClick={() => setDeleteAttachment(file)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!deleteAttachment}
        title="Delete attachment?"
        description={`"${deleteAttachment?.originalName}" will be permanently deleted.`}
        loading={remove.isPending}
        onConfirm={() => deleteAttachment && remove.mutate(deleteAttachment.id)}
        onClose={() => setDeleteAttachment(undefined)}
      />
      <label className="upload">
        <FileUp size={15} /> Upload file
        <input
          type="file"
          onChange={(e) =>
            e.target.files?.[0] && upload.mutate(e.target.files[0])
          }
        />
      </label>
    </section>
  );
}
