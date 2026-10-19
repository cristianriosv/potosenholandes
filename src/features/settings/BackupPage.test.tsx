import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { db } from '../../db/db';
import { createBackup } from '../../db/backup';
import { categories } from '../../db/repositories';
import { BackupPage } from './BackupPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

function renderPage() {
  return render(<MantineProvider><BackupPage /></MantineProvider>);
}

async function uploadFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('Backup file input was not rendered.');
  await user.upload(input, file);
}

describe('BackupPage', () => {
  it('previews a backup, merges safely, and preserves local user conflicts', async () => {
    const user = userEvent.setup();
    await categories.save({ id: 'local-category', name: 'Local version', source: 'user' });
    const backup = await createBackup();
    backup.categories = [{
      id: 'local-category', name: 'Incoming version', description: '', sortOrder: 0,
      source: 'imported', reviewStatus: 'draft', createdAt: 0, updatedAt: 1,
    }, {
      id: 'new-category', name: 'Imported category', description: '', sortOrder: 1,
      source: 'imported', reviewStatus: 'draft', createdAt: 0, updatedAt: 0,
    }];
    const file = new File([JSON.stringify(backup)], 'study-backup.json', { type: 'application/json' });
    renderPage();

    await uploadFile(user, file);
    expect(await screen.findByText('User-content conflicts')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Merge backup' }));
    expect(await screen.findByText('Backup merged. Existing user-created content was not overwritten.')).toBeInTheDocument();
    expect((await categories.get('local-category'))?.name).toBe('Local version');
    expect((await categories.get('new-category'))?.name).toBe('Imported category');
  });

  it('rejects invalid files and gates full restore behind acknowledgement and confirmation', async () => {
    const user = userEvent.setup();
    const existing = await categories.save({ id: 'existing-category', name: 'Keep until restore' });
    const backup = await createBackup();
    backup.categories = [{
      id: 'restored-category', name: 'Restored', description: '', sortOrder: 0,
      source: 'imported', reviewStatus: 'draft', createdAt: 0, updatedAt: 0,
    }];
    const invalidFile = new File(['not json'], 'invalid.json', { type: 'application/json' });
    const validFile = new File([JSON.stringify(backup)], 'valid.json', { type: 'application/json' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await uploadFile(user, invalidFile);
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
    expect(await categories.get(existing.id)).toBeDefined();

    await uploadFile(user, validFile);
    const restoreButton = screen.getByRole('button', { name: 'Restore all data' });
    expect(restoreButton).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /full restore replaces/i }));
    expect(restoreButton).toBeEnabled();
    await user.click(restoreButton);
    expect(confirm).toHaveBeenCalledWith('Replace all learning content and local progress with this backup? This cannot be undone.');
    expect(await screen.findByText('Backup restored. Local learning content and progress now match the selected file.')).toBeInTheDocument();
    expect(await categories.get('existing-category')).toBeUndefined();
    expect((await categories.get('restored-category'))?.name).toBe('Restored');
    confirm.mockRestore();
  });
});
