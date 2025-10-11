import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        const file = files[0];
        if (file.type === "application/pdf") {
          setSelectedFile(file);
          onFileSelect(file);
        } else {
          toast({
            title: "Invalid file type",
            description: "Please upload a PDF file.",
            variant: "destructive",
          });
        }
      }
    },
    [onFileSelect, toast]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        const file = files[0];
        if (file.type === "application/pdf") {
          setSelectedFile(file);
          onFileSelect(file);
        } else {
          toast({
            title: "Invalid file type",
            description: "Please upload a PDF file.",
            variant: "destructive",
          });
        }
      }
    },
    [onFileSelect, toast]
  );

  return (
    <Card
      className={`relative border-2 border-dashed transition-all duration-300 ${
        isDragging
          ? "border-primary bg-primary/5 shadow-[var(--shadow-glow)]"
          : "border-border hover:border-primary/50"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="p-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
          {selectedFile ? (
            <FileText className="w-12 h-12 text-primary" />
          ) : (
            <Upload className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">
            {selectedFile ? selectedFile.name : "Drop your PDF here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedFile
              ? "File ready to upload"
              : "or click to browse your files"}
          </p>
        </div>

        <input
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <Button asChild variant="outline" size="lg">
          <label htmlFor="file-upload" className="cursor-pointer">
            Browse Files
          </label>
        </Button>

        {selectedFile && (
          <div className="text-xs text-muted-foreground">
            Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}
      </div>
    </Card>
  );
};
