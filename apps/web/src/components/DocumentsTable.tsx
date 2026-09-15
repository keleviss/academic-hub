import { FileText } from 'lucide-react';
import { formatFileSize } from '../lib/format-file-size';

type DocumentTableRow = {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'replaced' | 'deleted';
  visibility: 'visible_to_students' | 'hidden_from_students';
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  pageCount: number | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Shared Όνομα/Μέγεθος/Ημερομηνία/[Ορατότητα]/Ενέργειες table layout for course document
 * lists (professor, student, ...). Callers own the name/visibility/actions cell content.
 */
export function DocumentsTable<T extends DocumentTableRow>({
  documents,
  onDocTitleClick,
  renderVisibility,
  renderActions,
}: {
  documents: T[];
  onDocTitleClick: (document: T) => void;
  renderVisibility?: (document: T) => React.ReactNode;
  renderActions: (document: T) => React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="table-responsive">
      <table className="document-table">
        <thead>
          <tr>
            <th scope="col">Όνομα</th>
            <th scope="col">Μέγεθος</th>
            <th scope="col">Ημερομηνία</th>
            {renderVisibility && <th scope="col">Ορατότητα</th>}
            <th scope="col">Ενέργειες</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id}>
              <td className="document-name-cell">
                <div className="document-name-cell-content">
                  <FileText aria-hidden="true" size={20} />
                  <div className="document-row-main">
                    <button
                      className="document-row-title"
                      type="button"
                      onClick={() => onDocTitleClick(document)}
                    >
                      {document.title}
                    </button>
                    <span className="document-row-doc-name">
                      {document.originalFilename}
                    </span>
                  </div>
                </div>
              </td>
              <td className="document-row-file-size">
                {formatFileSize(document.fileSizeBytes)}
              </td>
              <td className="document-row-date">
                {new Date(document.updatedAt).toLocaleDateString('el-GR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </td>
              {renderVisibility && <td>{renderVisibility(document)}</td>}
              <td>{renderActions(document)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
