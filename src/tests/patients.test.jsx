import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { PatientsList } from '../features/patients/PatientsList';
import { PatientCreate } from '../features/patients/PatientCreate';
import { PatientSearchBar } from '../features/patients/PatientSearchBar';

const listPatientsSpy = vi.fn();
const createPatientSpy = vi.fn();
let createPatientState;
const showToastSpy = vi.fn();

vi.mock('../components/ToastContext', () => ({
  ToastProvider: ({ children }) => <>{children}</>,
  useToast: () => ({ showToast: showToastSpy })
}));


vi.mock('../features/patients/patientsApi', () => ({
  useListPatientsQuery: (args) => {
    listPatientsSpy(args);
    return {
      data: { items: [{ id: '1', identifier: 'MRN1', first_name: 'Ada', last_name: 'Lovelace', birthdate: '1815-12-10', phone: '5551234567', email: 'ada@example.com' }], total: 1 },
      error: null,
      isFetching: false,
      refetch: vi.fn()
    };
  },
  patientsApi: { util: { prefetch: () => ({ type: 'patients/prefetch' }) } },
  useCreatePatientMutation: () => [createPatientSpy, createPatientState]
}));

describe('Patients feature', () => {
  beforeEach(() => {
    listPatientsSpy.mockClear();
    createPatientSpy.mockClear();
    createPatientState = { isLoading: false, isSuccess: false, error: null };
    showToastSpy.mockClear();
  });

  it('loads patient list with pagination parameters', () => {
    renderWithProviders(<PatientsList />, { route: '/patients' });
    expect(listPatientsSpy).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      filters: { identifier: '', name: '', birthdate: '', phone: '', email: '' }
    });
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
  });

  it('debounces patient search input', async () => {
    const onSearch = vi.fn();
    renderWithProviders(<PatientSearchBar onSearch={onSearch} delay={10} />, { route: '/patients' });
    fireEvent.change(screen.getByPlaceholderText(/Identifier/i), { target: { value: '123' } });
    expect(onSearch).not.toHaveBeenCalled();
    await waitFor(() => expect(onSearch).toHaveBeenCalled(), { timeout: 200 });
  });

  it('validates patient creation form and submits payload', async () => {
    renderWithProviders(<PatientCreate />, { route: '/patients/new' });
    fireEvent.submit(screen.getByRole('button', { name: /create patient/i }));
    expect(await screen.findAllByText(/required/i)).toBeTruthy();
    expect(createPatientSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Identifier/i), { target: { value: 'MRN2' } });
    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Hopper' } });
    fireEvent.change(screen.getByLabelText(/Birthdate/i), { target: { value: '1906-12-09' } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '5559991234' } });
    fireEvent.submit(screen.getByRole('button', { name: /create patient/i }));
    expect(createPatientSpy).toHaveBeenCalled();
  });

  it('displays server-side validation errors', async () => {
    createPatientState = {
      isLoading: false,
      isSuccess: false,
      error: { data: { identifier: ['Identifier already exists'] } }
    };

    renderWithProviders(<PatientCreate />, { route: '/patients/new' });
    expect(showToastSpy).toHaveBeenCalledWith('Please review the highlighted fields.');
    expect(screen.getByText(/Identifier already exists/)).toBeInTheDocument();
  });
});
