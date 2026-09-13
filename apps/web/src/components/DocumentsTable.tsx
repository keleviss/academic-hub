import { FileText } from 'lucide-react';

import { formatFileSize } from '../lib/format-file-size';

type DocumentTableRow = {
  id: string;
  fileSizeBytes: number | null;
  updatedAt: string;
};

/**
 * Shared Όνομα/Μέγεθος/Ημερομηνία/[Ορατότητα]/Ενέργειες table layout for course document
 * lists (professor, student, ...). Callers own the name/visibility/actions cell content.
 */
export function DocumentsTable<T extends DocumentTableRow>({
  documents,
  renderName,
  renderVisibility,
  renderActions,
}: {
  documents: T[];
  renderName: (document: T) => React.ReactNode;
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
                <FileText aria-hidden="true" size={20} />
                {renderName(document)}
              </td>
              <td>{formatFileSize(document.fileSizeBytes)}</td>
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
