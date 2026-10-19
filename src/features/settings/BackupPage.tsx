import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  FileInput,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { applyBackup, createBackup, previewBackup, type ImportPreview } from '../../db/backup';

const countRows: { key: keyof ImportPreview['totals']; label: string }[] = [
  { key: 'additions', label: 'Additions' },
  { key: 'updates', label: 'Updates' },
  { key: 'duplicates', label: 'Exact duplicates' },
  { key: 'conflicts', label: 'User-content conflicts' },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The backup operation failed.';
}

export function BackupPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const exportBackup = async () => {
    setError(null);
    setNotice(null);
    try {
      const backup = await createBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `potosenholandes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('Backup exported. Keep the file somewhere separate from this device.');
    } catch (exportError) {
      setError(errorMessage(exportError));
    }
  };

  const loadBackup = async (file: File | null) => {
    setSelectedFile(file);
    setPreview(null);
    setError(null);
    setNotice(null);
    setConfirmRestore(false);
    if (!file) return;
    try {
      setPreview(await previewBackup(await file.text()));
    } catch (parseError) {
      setError(errorMessage(parseError));
    }
  };

  const importBackup = async (mode: 'merge' | 'restore') => {
    if (!preview) return;
    if (mode === 'restore' && !window.confirm('Replace all learning content and local progress with this backup? This cannot be undone.')) return;
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await applyBackup(preview.backup, mode);
      setNotice(mode === 'merge'
        ? 'Backup merged. Existing user-created content was not overwritten.'
        : 'Backup restored. Local learning content and progress now match the selected file.');
      setPreview(await previewBackup(preview.backup));
      setConfirmRestore(false);
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Stack>
      <Title order={2}>Settings and backups</Title>
      <Paper withBorder p="md">
        <Stack>
          <Title order={3}>Export local data</Title>
          <Text size="sm" c="dimmed">Export categories, learning content, attempts, review history, and legacy progress to a versioned JSON file.</Text>
          <Button w="fit-content" onClick={() => void exportBackup()}>Export backup</Button>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack>
          <Title order={3}>Import backup</Title>
          <FileInput
            label="Backup file"
            placeholder="Choose a JSON backup"
            accept="application/json,.json"
            value={selectedFile}
            onChange={(file) => void loadBackup(file)}
            clearable
          />
          {error && <Alert color="red" title="Backup not applied" role="alert">{error}</Alert>}
          {notice && <Alert color="green" title="Backup complete" role="status">{notice}</Alert>}
          {preview && (
            <>
              <Group gap="xs">
                <Badge>Schema v{preview.backup.schemaVersion}</Badge>
                <Text size="sm">Exported {new Date(preview.backup.exportedAt).toLocaleString()}</Text>
              </Group>
              <Table striped withTableBorder withColumnBorders aria-label="Backup import preview">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Records</Table.Th>
                    {countRows.map((row) => <Table.Th key={row.key}>{row.label}</Table.Th>)}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(preview.collections).map(([collection, counts]) => (
                    <Table.Tr key={collection}>
                      <Table.Th>{collection}</Table.Th>
                      {countRows.map((row) => <Table.Td key={row.key}>{counts[row.key]}</Table.Td>)}
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Th>Total</Table.Th>
                    {countRows.map((row) => <Table.Th key={row.key}>{preview.totals[row.key]}</Table.Th>)}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              <Text size="sm" c="dimmed">Merge adds new records, updates non-user records, skips exact duplicates, and keeps local user-created records in conflicts.</Text>
              {preview.totals.conflicts > 0 && <Alert color="yellow" title="Conflicts will be kept locally">No user-created record will be overwritten during merge.</Alert>}
              <Group>
                <Button loading={isBusy} onClick={() => void importBackup('merge')}>Merge backup</Button>
                <Button color="red" variant="light" loading={isBusy} disabled={!confirmRestore} onClick={() => void importBackup('restore')}>Restore all data</Button>
              </Group>
              <Checkbox
                checked={confirmRestore}
                onChange={(event) => setConfirmRestore(event.currentTarget.checked)}
                label="I understand full restore replaces all local content and progress."
              />
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}