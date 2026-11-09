import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Paperclip, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, ConfirmDialog } from "../../../components/ui";
import { api } from "../../../lib/api";
import { keys } from "../../../lib/query-keys";
import type { Attachment } from "../../../lib/types";
import { saveBlobFile } from "../task-utils";

// Mirrors the API's upload allowlist so a wrong file fails before uploading.
export const ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ATTACHMENT_TYPES_HINT = "PDF, JPEG, PNG, WebP, TXT, ZIP, DOCX or XLSX";

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
    onSuccess: () => {
      void refresh();
      toast.success("Attachment uploaded");
    },
  });
  const download = useMutation({
    mutationFn: async (attachment: Attachment) => {
      const { blob, fileName } = await api.downloadAttachment(
        taskId,
        attachment,
      );
      saveBlobFile(blob, fileName);
    },
  });
  const uploadFile = (file: File) => {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      toast.error(`Upload a ${ATTACHMENT_TYPES_HINT} file.`);
      return;
    }
    upload.mutate(file);
  };
  return (
    <section>
      <h3>
        <Paperclip size={15} /> Attachments
      </h3>
      <div className="attachment-list">
        {data?.map((file) => (
          <div className="attachment" key={file.id}>
            <Button
              variant="ghost"
              className="attachment-download"
              aria-label={`Download ${file.originalName}`}
              loading={download.isPending && download.variables.id === file.id}
              onClick={() => download.mutate(file)}
            >
              <Download size={14} /> {file.originalName}
            </Button>
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
        <FileUp size={15} /> {upload.isPending ? "Uploading..." : "Upload file"}
        <input
          type="file"
          accept={ATTACHMENT_TYPES.join(",")}
          disabled={upload.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so picking the same file again still triggers onChange.
            event.currentTarget.value = "";
            if (file) uploadFile(file);
          }}
        />
      </label>
    </section>
  );
}
