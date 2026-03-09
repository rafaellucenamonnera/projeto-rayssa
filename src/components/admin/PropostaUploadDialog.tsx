import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface PropostaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onSuccess: (propostaUrl: string) => void;
  onCancel: () => void;
}

export function PropostaUploadDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onSuccess,
  onCancel,
}: PropostaUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast.error("Por favor, selecione um arquivo PDF");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("O arquivo deve ter no máximo 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${leadId}-${Date.now()}.${fileExt}`;
      const filePath = `propostas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("propostas")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("propostas")
        .getPublicUrl(filePath);

      onSuccess(urlData.publicUrl);
      setFile(null);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Anexar Proposta Comercial
          </DialogTitle>
          <DialogDescription>
            Para alterar o status para "Proposta Comercial", é obrigatório anexar o PDF da proposta para o lead <strong>{leadName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="proposta-file">Arquivo PDF da Proposta</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                id="proposta-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Enviar e Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
