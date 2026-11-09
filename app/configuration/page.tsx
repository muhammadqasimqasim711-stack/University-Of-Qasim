"use client";

import { FormEvent, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminViewMode } from "@/app/session-context";
import {
  addCalendarDays,
  calendarDateInKarachi,
  formatDisplayDate,
  formatDisplayTimestamp,
} from "@/lib/dates";
import { BOOK_CATEGORIES } from "@/lib/book-categories";

type FieldErrors = {
  libraryName?: string[];
  contactEmail?: string[];
  borrowingPeriodDays?: string[];
  maxBooksPerStudent?: string[];
  maxBooksPerTeacher?: string[];
  monthlyBorrowLimit?: string[];
  defaultCopiesPerBook?: string[];
  barcodeStart?: string[];
  barcodeEnd?: string[];
  password?: string[];
};

type ConfigurationResponse = {
  libraryName: string;
  contactEmail: string;
  borrowingPeriodDays: number;
  maxBooksPerStudent: number;
  maxBooksPerTeacher: number;
  monthlyBorrowLimit: number;
  defaultCopiesPerBook: number;
  barcodeStart?: string;
  barcodeEnd?: string;
  updatedAt: string;
  issueDate: string;
  returnDate: string;
};

function firstError(errors: string[] | undefined) {
  return errors?.[0];
}

function wholeNumberInRange(value: string, min: number, max: number) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

// ─── Master Data Types ───
type Department = { id: number; name: string; programs?: Program[] };
type Program = { id: number; name: string; departmentId: number; department?: Department };
type Semester = { id: number; name: string };
type BatchSession = { id: number; name: string };
type Designation = { id: number; title: string };
type Author = {
  id: number;
  fullName: string;
  nationality: string;
  email: string;
  biography: string;
  booksCount?: number;
};
type Shelf = {
  id: number;
  shelfNumber: string;
  category: string;
  location: string;
  capacity: number | null;
  description: string;
};
type Publisher = {
  id: number;
  name: string;
  address: string;
  contact: string;
  email: string;
  booksCount?: number;
};

type MasterTab = "departments" | "programs" | "semesters" | "batches" | "designations" | "authors" | "publishers" | "shelves";

// ─── Reusable CRUD Table Component ───
function CrudSection<T extends { id: number }>({
  title,
  items,
  loading,
  columns,
  renderRow,
  onAdd,
  onEdit,
  onDelete,
  addForm,
  editForm,
}: {
  title: string;
  items: T[];
  loading: boolean;
  columns: string[];
  renderRow: (item: T) => React.ReactNode[];
  onAdd: () => void;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
  addForm: React.ReactNode;
  editForm: React.ReactNode;
}) {
  return (
    <div>
      {addForm}
      {editForm}
      {loading ? (
        <p className="panel status">Loading {title.toLowerCase()}…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)", fontStyle: "italic", padding: "16px 0" }}>
          No {title.toLowerCase()} yet. Add one above.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  {renderRow(item).map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="button-quiet"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => onEdit(item)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="button-quiet"
                        style={{ fontSize: 12, padding: "4px 10px", color: "var(--danger, #b91c1c)" }}
                        onClick={() => onDelete(item)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MasterConfigurationPage() {
  const router = useRouter();
  const { setAdminViewMode } = useAdminViewMode();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Form Fields
  const [savedLibraryName, setSavedLibraryName] = useState("University of Qasim");
  const [updatedAt, setUpdatedAt] = useState("");
  const [libraryName, setLibraryName] = useState("University of Qasim");
  const [contactEmail, setContactEmail] = useState("library@uoq.edu.pk");
  const [borrowingPeriodDays, setBorrowingPeriodDays] = useState("14");
  const [maxBooksPerStudent, setMaxBooksPerStudent] = useState("3");
  const [maxBooksPerTeacher, setMaxBooksPerTeacher] = useState("5");
  const [monthlyBorrowLimit, setMonthlyBorrowLimit] = useState("5");
  const [defaultCopiesPerBook, setDefaultCopiesPerBook] = useState("10");
  const [barcodeStart, setBarcodeStart] = useState("BC-001");
  const [barcodeEnd, setBarcodeEnd] = useState("BC-100");
  const [password, setPassword] = useState("");
  const [barcodeStats, setBarcodeStats] = useState<{
    barcode?: string;
    allocatedCount?: number;
    totalCapacity?: number;
    error?: string;
  } | null>(null);

  // Master Data Tab State
  const [activeTab, setActiveTab] = useState<MasterTab>("departments");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [batches, setBatches] = useState<BatchSession[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState("");
  const [masterSuccess, setMasterSuccess] = useState("");

  // Add/Edit form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [addName, setAddName] = useState("");
  const [addDeptId, setAddDeptId] = useState("");
  const [addNationality, setAddNationality] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addBiography, setAddBiography] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [addCapacity, setAddCapacity] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addContact, setAddContact] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [editName, setEditName] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editNationality, setEditNationality] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBiography, setEditBiography] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editAddress, setEditAddress] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadConfiguration() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/api/configuration", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load the master configuration.");
        }

        const configuration = (await response.json()) as ConfigurationResponse;
        if (ignore) {
          return;
        }

        setSavedLibraryName(configuration.libraryName || "University of Qasim");
        setLibraryName(configuration.libraryName || "University of Qasim");
        setContactEmail(configuration.contactEmail || "library@uoq.edu.pk");
        setBorrowingPeriodDays(String(configuration.borrowingPeriodDays ?? 14));
        setMaxBooksPerStudent(String(configuration.maxBooksPerStudent ?? 3));
        setMaxBooksPerTeacher(String(configuration.maxBooksPerTeacher ?? 5));
        setMonthlyBorrowLimit(String(configuration.monthlyBorrowLimit ?? 5));
        setDefaultCopiesPerBook(String(configuration.defaultCopiesPerBook ?? 10));
        setBarcodeStart(configuration.barcodeStart || "BC-001");
        setBarcodeEnd(configuration.barcodeEnd || "BC-100");
        setUpdatedAt(configuration.updatedAt || "");

        // Fetch barcode allocation stats
        try {
          const statsRes = await fetch("/api/books/next-barcode", { cache: "no-store" });
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (!ignore) {
              setBarcodeStats(statsData);
            }
          }
        } catch {
          // ignore stats load error
        }
      } catch {
        if (!ignore) {
          setLoadError("Could not load the master configuration.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadConfiguration();

    return () => {
      ignore = true;
    };
  }, []);

  // Fetch master data for current tab
  const fetchMasterData = useCallback(async (tab: MasterTab) => {
    setMasterLoading(true);
    setMasterError("");
    try {
      switch (tab) {
        case "departments": {
          const res = await fetch("/api/master/departments?includePrograms=true");
          if (res.ok) setDepartments(await res.json());
          break;
        }
        case "programs": {
          const [progRes, deptRes] = await Promise.all([
            fetch("/api/master/programs"),
            fetch("/api/master/departments"),
          ]);
          if (progRes.ok) setPrograms(await progRes.json());
          if (deptRes.ok) setDepartments(await deptRes.json());
          break;
        }
        case "semesters": {
          const res = await fetch("/api/master/semesters");
          if (res.ok) setSemesters(await res.json());
          break;
        }
        case "batches": {
          const res = await fetch("/api/master/batches");
          if (res.ok) setBatches(await res.json());
          break;
        }
        case "designations": {
          const res = await fetch("/api/master/designations");
          if (res.ok) setDesignations(await res.json());
          break;
        }
        case "authors": {
          const res = await fetch("/api/authors");
          if (res.ok) setAuthors(await res.json());
          break;
        }
        case "publishers": {
          const res = await fetch("/api/publishers");
          if (res.ok) setPublishers(await res.json());
          break;
        }
        case "shelves": {
          const res = await fetch("/api/shelves");
          if (res.ok) setShelves(await res.json());
          break;
        }
      }
    } catch {
      setMasterError("Failed to load data.");
    } finally {
      setMasterLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData(activeTab);
  }, [activeTab, fetchMasterData]);

  // ─── CRUD Handlers ───

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setMasterError("");
    setMasterSuccess("");

    const endpoint =
      activeTab === "authors"
        ? `/api/authors`
        : activeTab === "publishers"
        ? `/api/publishers`
        : activeTab === "shelves"
        ? `/api/shelves`
        : `/api/master/${activeTab}`;
    let body: Record<string, any> = {};

    switch (activeTab) {
      case "departments":
        body = { name: addName };
        break;
      case "programs":
        body = { name: addName, departmentId: Number(addDeptId) };
        break;
      case "semesters":
        body = { name: addName };
        break;
      case "batches":
        body = { name: addName };
        break;
      case "designations":
        body = { title: addName };
        break;
      case "authors":
        body = {
          fullName: addName,
          nationality: addNationality,
          email: addEmail,
          biography: addBiography,
        };
        break;
      case "publishers":
        body = {
          name: addName,
          address: addAddress,
          contact: addContact,
          email: addEmail,
        };
        break;
      case "shelves":
        body = {
          shelfNumber: addName,
          category: addCategory,
          location: addLocation,
          capacity: addCapacity ? Number(addCapacity) : null,
          description: addDescription,
        };
        break;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setMasterError(data.message || "Failed to add.");
        return;
      }

      setMasterSuccess(`Added successfully!`);
      setAddName("");
      setAddDeptId("");
      setAddNationality("");
      setAddEmail("");
      setAddBiography("");
      setAddCategory("");
      setAddLocation("");
      setAddCapacity("");
      setAddDescription("");
      setAddContact("");
      setAddAddress("");
      setShowAddForm(false);
      fetchMasterData(activeTab);
    } catch {
      setMasterError("Failed to add.");
    }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    setMasterError("");
    setMasterSuccess("");

    const endpoint =
      activeTab === "authors"
        ? `/api/authors/${editingItem.id}`
        : activeTab === "publishers"
        ? `/api/publishers/${editingItem.id}`
        : activeTab === "shelves"
        ? `/api/shelves/${editingItem.id}`
        : `/api/master/${activeTab}`;
    let body: Record<string, any> =
      activeTab === "authors" || activeTab === "publishers" || activeTab === "shelves" ? {} : { id: editingItem.id };

    switch (activeTab) {
      case "departments":
        body.name = editName;
        break;
      case "programs":
        body.name = editName;
        body.departmentId = Number(editDeptId);
        break;
      case "semesters":
        body.name = editName;
        break;
      case "batches":
        body.name = editName;
        break;
      case "designations":
        body.title = editName;
        break;
      case "authors":
        body = {
          fullName: editName,
          nationality: editNationality,
          email: editEmail,
          biography: editBiography,
        };
        break;
      case "publishers":
        body = {
          name: editName,
          address: editAddress,
          contact: editContact,
          email: editEmail,
        };
        break;
      case "shelves":
        body = {
          shelfNumber: editName,
          category: editCategory,
          location: editLocation,
          capacity: editCapacity ? Number(editCapacity) : null,
          description: editDescription,
        };
        break;
    }

    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setMasterError(data.message || "Failed to update.");
        return;
      }

      setMasterSuccess(`Updated successfully!`);
      setEditingItem(null);
      fetchMasterData(activeTab);
    } catch {
      setMasterError("Failed to update.");
    }
  }

  async function handleDelete(item: { id: number }) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    setMasterError("");
    setMasterSuccess("");

    const endpoint =
      activeTab === "authors"
        ? `/api/authors/${item.id}`
        : activeTab === "publishers"
        ? `/api/publishers/${item.id}`
        : activeTab === "shelves"
        ? `/api/shelves/${item.id}`
        : `/api/master/${activeTab}?id=${item.id}`;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setMasterError(data.message || "Failed to delete.");
        return;
      }

      setMasterSuccess(`Deleted successfully!`);
      fetchMasterData(activeTab);
    } catch {
      setMasterError("Failed to delete.");
    }
  }

  function startEdit(item: any) {
    setEditingItem(item);
    setShowAddForm(false);
    setMasterError("");
    setMasterSuccess("");
    if (activeTab === "designations") {
      setEditName(item.title);
    } else if (activeTab === "authors") {
      setEditName(item.fullName || "");
      setEditNationality(item.nationality || "");
      setEditEmail(item.email || "");
      setEditBiography(item.biography || "");
    } else if (activeTab === "publishers") {
      setEditName(item.name || "");
      setEditAddress(item.address || "");
      setEditContact(item.contact || "");
      setEditEmail(item.email || "");
    } else if (activeTab === "shelves") {
      setEditName(item.shelfNumber || "");
      setEditCategory(item.category || "");
      setEditLocation(item.location || "");
      setEditCapacity(item.capacity !== null && item.capacity !== undefined ? String(item.capacity) : "");
      setEditDescription(item.description || "");
    } else {
      setEditName(item.name);
    }
    if (activeTab === "programs") {
      setEditDeptId(String(item.departmentId));
    }
  }

  function startAdd() {
    setShowAddForm(true);
    setEditingItem(null);
    setAddName("");
    setAddDeptId("");
    setAddNationality("");
    setAddEmail("");
    setAddBiography("");
    setAddCategory("");
    setAddLocation("");
    setAddCapacity("");
    setAddDescription("");
    setAddContact("");
    setAddAddress("");
    setMasterError("");
    setMasterSuccess("");
  }

  // Live Calculations for Preview
  const period = wholeNumberInRange(borrowingPeriodDays, 1, 365);
  const studentLimit = wholeNumberInRange(maxBooksPerStudent, 1, 20);
  const teacherLimit = wholeNumberInRange(maxBooksPerTeacher, 1, 20);
  const monthLimit = wholeNumberInRange(monthlyBorrowLimit, 1, 30);
  const copiesCount = wholeNumberInRange(defaultCopiesPerBook, 1, 100);

  const issueDate = calendarDateInKarachi();
  const returnDate = period === null ? null : addCalendarDays(issueDate, period);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSuccess("");
    setFormError("");
    setFieldErrors({});

    try {
      const response = await fetch("/api/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libraryName,
          contactEmail,
          borrowingPeriodDays: Number(borrowingPeriodDays),
          maxBooksPerStudent: Number(maxBooksPerStudent),
          maxBooksPerTeacher: Number(maxBooksPerTeacher),
          monthlyBorrowLimit: Number(monthlyBorrowLimit),
          defaultCopiesPerBook: Number(defaultCopiesPerBook),
          barcodeStart,
          barcodeEnd,
          password,
        }),
      });

      const body = (await response.json()) as ConfigurationResponse & {
        message?: string;
        errors?: FieldErrors;
      };

      if (!response.ok) {
        setFieldErrors(body.errors ?? {});
        setFormError(body.message ?? "Could not save the configuration.");
        return;
      }

      setSavedLibraryName(body.libraryName);
      setLibraryName(body.libraryName);
      setContactEmail(body.contactEmail);
      setBorrowingPeriodDays(String(body.borrowingPeriodDays));
      setMaxBooksPerStudent(String(body.maxBooksPerStudent));
      setMaxBooksPerTeacher(String(body.maxBooksPerTeacher));
      setMonthlyBorrowLimit(String(body.monthlyBorrowLimit));
      setDefaultCopiesPerBook(String(body.defaultCopiesPerBook));
      setBarcodeStart(body.barcodeStart || "BC-001");
      setBarcodeEnd(body.barcodeEnd || "BC-100");
      setPassword("");
      setUpdatedAt(body.updatedAt);
      setSuccess("Master configuration updated successfully! Rules are now active across the entire library.");

      // Refresh barcode allocation stats
      try {
        const statsRes = await fetch("/api/books/next-barcode", { cache: "no-store" });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setBarcodeStats(statsData);
        }
      } catch {
        // ignore
      }
    } catch {
      setFormError("Could not save the configuration.");
    } finally {
      setSaving(false);
    }
  }

  // Error extractors
  const libraryNameError = firstError(fieldErrors.libraryName);
  const contactEmailError = firstError(fieldErrors.contactEmail);
  const periodError = firstError(fieldErrors.borrowingPeriodDays);
  const studentLimitError = firstError(fieldErrors.maxBooksPerStudent);
  const teacherLimitError = firstError(fieldErrors.maxBooksPerTeacher);
  const monthLimitError = firstError(fieldErrors.monthlyBorrowLimit);
  const copiesError = firstError(fieldErrors.defaultCopiesPerBook);
  const barcodeStartError = firstError(fieldErrors.barcodeStart);
  const barcodeEndError = firstError(fieldErrors.barcodeEnd);
  const passwordError = firstError(fieldErrors.password);

  // ─── Tab configuration ───
  const tabs: { key: MasterTab; label: string; icon: string }[] = [
    { key: "departments", label: "Departments", icon: "🏢" },
    { key: "programs", label: "Programs", icon: "📘" },
    { key: "semesters", label: "Semesters", icon: "📅" },
    { key: "batches", label: "Batch Sessions", icon: "📋" },
    { key: "designations", label: "Designations", icon: "🎓" },
    { key: "authors", label: "Authors", icon: "✍️" },
    { key: "publishers", label: "Publishers", icon: "🏛️" },
    { key: "shelves", label: "Shelves", icon: "🗄️" },
  ];

  // ─── Add form renderers ───
  function renderAddForm() {
    const entityLabel =
      activeTab === "designations"
        ? "Designation"
        : activeTab === "batches"
        ? "Batch Session"
        : activeTab === "authors"
        ? "Author"
        : activeTab === "publishers"
        ? "Publisher"
        : activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1);

    if (!showAddForm) {
      return (
        <button type="button" onClick={startAdd} style={{ marginBottom: 16, fontSize: 13 }}>
          ➕ Add New {entityLabel}
        </button>
      );
    }

    if (activeTab === "authors") {
      return (
        <form onSubmit={handleAdd} style={{ marginBottom: 20, padding: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 12px" }}>Add New Author</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Full Name *</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Author's full name…"
                required
              />
            </div>
            <div className="field">
              <label>Nationality</label>
              <input
                value={addNationality}
                onChange={(e) => setAddNationality(e.target.value)}
                placeholder="e.g. Pakistani, British…"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="author@example.com"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Biography</label>
            <textarea
              rows={2}
              value={addBiography}
              onChange={(e) => setAddBiography(e.target.value)}
              placeholder="Brief biography or notes about the author…"
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Save Author</button>
            <button type="button" className="button-quiet" onClick={() => setShowAddForm(false)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    if (activeTab === "publishers") {
      return (
        <form onSubmit={handleAdd} style={{ marginBottom: 20, padding: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 12px" }}>Add New Publisher</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Publisher Name *</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Publisher / Press name…"
                required
              />
            </div>
            <div className="field">
              <label>Contact / Phone</label>
              <input
                value={addContact}
                onChange={(e) => setAddContact(e.target.value)}
                placeholder="Phone or contact info…"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="publisher@example.com"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Address / Description</label>
            <textarea
              rows={2}
              value={addAddress}
              onChange={(e) => setAddAddress(e.target.value)}
              placeholder="Publisher address or location details…"
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Save Publisher</button>
            <button type="button" className="button-quiet" onClick={() => setShowAddForm(false)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    if (activeTab === "shelves") {
      return (
        <form onSubmit={handleAdd} style={{ marginBottom: 20, padding: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 12px" }}>Add New Shelf</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Shelf Number / Code *</label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. CS-01, BIO-02, A-1…"
                required
              />
            </div>
            <div className="field">
              <label>Category *</label>
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
                required
              >
                <option value="">-- Select Category --</option>
                {BOOK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <input
                value={addLocation}
                onChange={(e) => setAddLocation(e.target.value)}
                placeholder="e.g. 2nd Floor, Aisle 3"
              />
            </div>
            <div className="field">
              <label>Capacity (Number of Books)</label>
              <input
                type="number"
                min={0}
                value={addCapacity}
                onChange={(e) => setAddCapacity(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description / Notes</label>
            <textarea
              rows={2}
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              placeholder="Additional shelf details or notes…"
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Save Shelf</button>
            <button type="button" className="button-quiet" onClick={() => setShowAddForm(false)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={handleAdd} style={{ marginBottom: 20, padding: 16, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
        <h4 style={{ margin: "0 0 12px" }}>Add New {entityLabel}</h4>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          {activeTab === "programs" && (
            <div className="field" style={{ minWidth: 200 }}>
              <label>Department *</label>
              <select value={addDeptId} onChange={(e) => setAddDeptId(e.target.value)} required>
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field" style={{ minWidth: 250, flex: 1 }}>
            <label>{activeTab === "designations" ? "Title" : "Name"} *</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={`Enter ${activeTab === "designations" ? "designation title" : "name"}…`}
              required
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Save</button>
            <button type="button" className="button-quiet" onClick={() => setShowAddForm(false)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  function renderEditForm() {
    if (!editingItem) return null;

    const entityLabel =
      activeTab === "designations"
        ? "Designation"
        : activeTab === "batches"
        ? "Batch Session"
        : activeTab === "authors"
        ? "Author"
        : activeTab === "publishers"
        ? "Publisher"
        : activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1);

    if (activeTab === "authors") {
      return (
        <form onSubmit={handleEdit} style={{ marginBottom: 20, padding: 16, background: "#fffdf5", border: "1px solid var(--line)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 12px" }}>Edit Author (ID: {editingItem.id})</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Full Name *</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Nationality</label>
              <input
                value={editNationality}
                onChange={(e) => setEditNationality(e.target.value)}
                placeholder="e.g. Pakistani, British…"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Biography</label>
            <textarea
              rows={2}
              value={editBiography}
              onChange={(e) => setEditBiography(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Update Author</button>
            <button type="button" className="button-quiet" onClick={() => setEditingItem(null)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    if (activeTab === "publishers") {
      return (
        <form onSubmit={handleEdit} style={{ marginBottom: 20, padding: 16, background: "#fffdf5", border: "1px solid var(--line)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 12px" }}>Edit Publisher (ID: {editingItem.id})</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Publisher Name *</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Contact / Phone</label>
              <input
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
                placeholder="Phone or contact info…"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Address / Description</label>
            <textarea
              rows={2}
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Update Publisher</button>
            <button type="button" className="button-quiet" onClick={() => setEditingItem(null)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    if (activeTab === "shelves") {
      return (
        <form onSubmit={handleEdit} style={{ marginBottom: 20, padding: 16, background: "#fffdf5", border: "1px solid var(--line)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 12px" }}>Edit Shelf (ID: {editingItem.id})</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="field">
              <label>Shelf Number / Code *</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Category *</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                required
              >
                <option value="">-- Select Category --</option>
                {BOOK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g. 2nd Floor, Aisle 3"
              />
            </div>
            <div className="field">
              <label>Capacity (Number of Books)</label>
              <input
                type="number"
                min={0}
                value={editCapacity}
                onChange={(e) => setEditCapacity(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description / Notes</label>
            <textarea
              rows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Update Shelf</button>
            <button type="button" className="button-quiet" onClick={() => setEditingItem(null)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={handleEdit} style={{ marginBottom: 20, padding: 16, background: "#fffdf5", border: "1px solid var(--line)", borderRadius: 10 }}>
        <h4 style={{ margin: "0 0 12px" }}>Edit {entityLabel} (ID: {editingItem.id})</h4>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          {activeTab === "programs" && (
            <div className="field" style={{ minWidth: 200 }}>
              <label>Department *</label>
              <select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)} required>
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field" style={{ minWidth: 250, flex: 1 }}>
            <label>{activeTab === "designations" ? "Title" : "Name"} *</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ fontSize: 13 }}>Update</button>
            <button type="button" className="button-quiet" onClick={() => setEditingItem(null)} style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  // ─── Tab content renderers ───
  function renderTabContent() {
    switch (activeTab) {
      case "departments":
        return (
          <CrudSection<Department>
            title="Departments"
            items={departments}
            loading={masterLoading}
            columns={["Name", "Programs"]}
            renderRow={(d) => [
              d.name,
              d.programs ? d.programs.map((p) => p.name).join(", ") : "—",
            ]}
            onAdd={startAdd}
            onEdit={startEdit}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "programs":
        return (
          <CrudSection<Program>
            title="Programs"
            items={programs}
            loading={masterLoading}
            columns={["Name", "Department"]}
            renderRow={(p) => [p.name, p.department?.name || "—"]}
            onAdd={startAdd}
            onEdit={startEdit}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "semesters":
        return (
          <CrudSection<Semester>
            title="Semesters"
            items={semesters}
            loading={masterLoading}
            columns={["Name"]}
            renderRow={(s) => [s.name]}
            onAdd={startAdd}
            onEdit={startEdit}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "batches":
        return (
          <CrudSection<BatchSession>
            title="Batch Sessions"
            items={batches}
            loading={masterLoading}
            columns={["Name"]}
            renderRow={(b) => [b.name]}
            onAdd={startAdd}
            onEdit={startEdit}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "designations":
        return (
          <CrudSection<Designation>
            title="Designations"
            items={designations}
            loading={masterLoading}
            columns={["Title"]}
            renderRow={(d) => [d.title]}
            onAdd={() => startAdd()}
            onEdit={(item) => startEdit(item)}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "authors":
        return (
          <CrudSection<Author>
            title="Authors"
            items={authors}
            loading={masterLoading}
            columns={["Full Name", "Nationality", "Email", "Biography"]}
            renderRow={(a) => [
              <strong key="name">{a.fullName}</strong>,
              a.nationality || "—",
              a.email || "—",
              a.biography ? (
                <span key="bio" title={a.biography} style={{ display: "inline-block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.biography}
                </span>
              ) : "—",
            ]}
            onAdd={() => startAdd()}
            onEdit={(item) => startEdit(item)}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "publishers":
        return (
          <CrudSection<Publisher>
            title="Publishers"
            items={publishers}
            loading={masterLoading}
            columns={["Publisher Name", "Contact", "Email", "Address", "Books"]}
            renderRow={(p) => [
              <strong key="name">{p.name}</strong>,
              p.contact || "—",
              p.email || "—",
              p.address ? (
                <span key="addr" title={p.address} style={{ display: "inline-block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.address}
                </span>
              ) : "—",
              <span key="books" className="badge" style={{ fontSize: 12 }}>{p.booksCount ?? 0} books</span>,
            ]}
            onAdd={() => startAdd()}
            onEdit={(item) => startEdit(item)}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
      case "shelves":
        return (
          <CrudSection<Shelf>
            title="Shelves"
            items={shelves}
            loading={masterLoading}
            columns={["Shelf #", "Category", "Location", "Capacity", "Description"]}
            renderRow={(sh) => [
              <strong key="num">{sh.shelfNumber}</strong>,
              <span key="cat" className="badge" style={{ fontSize: 12 }}>{sh.category || "General"}</span>,
              sh.location || "—",
              sh.capacity !== null && sh.capacity !== undefined ? (
                <span key="cap" style={{ fontWeight: 600, color: sh.capacity <= 3 ? "var(--danger, #b91c1c)" : "inherit" }}>
                  {sh.capacity} books
                </span>
              ) : "Unlimited",
              sh.description ? (
                <span key="desc" title={sh.description} style={{ display: "inline-block", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sh.description}
                </span>
              ) : "—",
            ]}
            onAdd={() => startAdd()}
            onEdit={(item) => startEdit(item)}
            onDelete={handleDelete}
            addForm={renderAddForm()}
            editForm={renderEditForm()}
          />
        );
    }
  }

  return (
    <main className="shell shell-wide">
      <header className="masthead">
        <div className="mark" aria-hidden="true">
          {savedLibraryName
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "UQ"}
        </div>
        <div>
          <p className="eyebrow">Master Configuration</p>
          <h1>{savedLibraryName}</h1>
          <p className="lede">
            Configure system-wide library settings, circulation limits, borrowing quotas, and manage academic data (departments, programs, semesters, batches, designations).
            These settings govern the entire website.
          </p>
        </div>
      </header>

      {loading ? <p className="panel status">Loading master configuration…</p> : null}
      {loadError ? (
        <p className="banner error" role="alert">
          {loadError}
        </p>
      ) : null}

      {loading || loadError ? null : (
        <>
          <div className="layout">
          <form className="panel form-panel" onSubmit={onSubmit}>
            <h2>System Configuration</h2>
            <p className="panel-copy">
              Edit the library settings below. Saving immediately applies these rules to all student, teacher, and administrative workflows.
            </p>

            {success ? (
              <p className="banner ok" role="status">
                {success}
              </p>
            ) : null}
            {formError ? (
              <p className="banner error" role="alert">
                {formError}
              </p>
            ) : null}

            {/* SECTION 1: LIBRARY IDENTITY */}
            <div style={{ marginTop: 20, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                🏛️ Library Identity &amp; Contact
              </h3>
              <div className="fields-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                <div className="field">
                  <label htmlFor="libraryName">Library Name *</label>
                  <input
                    id="libraryName"
                    name="libraryName"
                    value={libraryName}
                    maxLength={120}
                    aria-invalid={libraryNameError ? true : undefined}
                    onChange={(event) => {
                      setLibraryName(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">The official name shown in branding, titles, and notices.</p>
                  {libraryNameError ? <p className="field-error">{libraryNameError}</p> : null}
                </div>

                <div className="field">
                  <label htmlFor="contactEmail">Official Contact Email *</label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={contactEmail}
                    maxLength={120}
                    aria-invalid={contactEmailError ? true : undefined}
                    onChange={(event) => {
                      setContactEmail(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Library desk email address for support and inquiries.</p>
                  {contactEmailError ? <p className="field-error">{contactEmailError}</p> : null}
                </div>

                <div className="field">
                  <label htmlFor="adminPassword">Password</label>
                  <input
                    id="adminPassword"
                    name="password"
                    type="password"
                    value={password}
                    autoComplete="new-password"
                    aria-invalid={passwordError ? true : undefined}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setSuccess("");
                    }}
                  />
                  <p className="field-help">
                    Set a new admin login password. Leave this blank to keep the current password.
                  </p>
                  {passwordError ? <p className="field-error">{passwordError}</p> : null}
                </div>
              </div>
            </div>

            {/* SECTION 2: BORROWING RULES & QUOTAS */}
            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                📚 Circulation Rules &amp; Inventory Capacities
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                {/* Borrowing Period */}
                <div className="field">
                  <label htmlFor="borrowingPeriodDays">Borrowing Period (Days) *</label>
                  <input
                    id="borrowingPeriodDays"
                    name="borrowingPeriodDays"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={borrowingPeriodDays}
                    aria-invalid={periodError ? true : undefined}
                    onChange={(event) => {
                      setBorrowingPeriodDays(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Standard loan duration (1 to 365 days).</p>
                  {periodError ? <p className="field-error">{periodError}</p> : null}
                </div>

                {/* Monthly Borrow Limit */}
                <div className="field">
                  <label htmlFor="monthlyBorrowLimit">Monthly Borrow Limit *</label>
                  <input
                    id="monthlyBorrowLimit"
                    name="monthlyBorrowLimit"
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={monthlyBorrowLimit}
                    aria-invalid={monthLimitError ? true : undefined}
                    onChange={(event) => {
                      setMonthlyBorrowLimit(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Max books a reader can borrow in one month (1–30).</p>
                  {monthLimitError ? <p className="field-error">{monthLimitError}</p> : null}
                </div>

                {/* Default Copies per Book */}
                <div className="field">
                  <label htmlFor="defaultCopiesPerBook">Default Copies Per Title *</label>
                  <input
                    id="defaultCopiesPerBook"
                    name="defaultCopiesPerBook"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={defaultCopiesPerBook}
                    aria-invalid={copiesError ? true : undefined}
                    onChange={(event) => {
                      setDefaultCopiesPerBook(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Circulation copies per catalogue title (1–100).</p>
                  {copiesError ? <p className="field-error">{copiesError}</p> : null}
                </div>
              </div>

              {/* Student vs Teacher Concurrent Limits */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="maxBooksPerStudent">Student Concurrent Limit *</label>
                  <input
                    id="maxBooksPerStudent"
                    name="maxBooksPerStudent"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={maxBooksPerStudent}
                    aria-invalid={studentLimitError ? true : undefined}
                    onChange={(event) => {
                      setMaxBooksPerStudent(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Max active borrowed books a student may hold at once (1–20).</p>
                  {studentLimitError ? <p className="field-error">{studentLimitError}</p> : null}
                </div>

                <div className="field">
                  <label htmlFor="maxBooksPerTeacher">Teacher Concurrent Limit *</label>
                  <input
                    id="maxBooksPerTeacher"
                    name="maxBooksPerTeacher"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={maxBooksPerTeacher}
                    aria-invalid={teacherLimitError ? true : undefined}
                    onChange={(event) => {
                      setMaxBooksPerTeacher(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Max active borrowed books a teacher may hold at once (1–20).</p>
                  {teacherLimitError ? <p className="field-error">{teacherLimitError}</p> : null}
                </div>
              </div>
            </div>

            {/* SECTION 3: BOOK BARCODE RANGE & AUTO GENERATION */}
            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                🏷️ Book Barcode Range &amp; Automatic Allocation
              </h3>
              <p className="panel-copy" style={{ marginBottom: 16 }}>
                Configure the barcode sequence for library books. When adding a book, its barcode is generated automatically in sequential order without manual input. If the total books reach the Barcode Ends limit, adding books is paused until you extend the limit here (e.g. to BC-200).
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="field">
                  <label htmlFor="barcodeStart">Barcode Starts *</label>
                  <input
                    id="barcodeStart"
                    name="barcodeStart"
                    value={barcodeStart}
                    placeholder="e.g. BC-001"
                    maxLength={40}
                    aria-invalid={barcodeStartError ? true : undefined}
                    onChange={(event) => {
                      setBarcodeStart(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Starting barcode code (e.g. BC-001).</p>
                  {barcodeStartError ? <p className="field-error">{barcodeStartError}</p> : null}
                </div>

                <div className="field">
                  <label htmlFor="barcodeEnd">Barcode Ends *</label>
                  <input
                    id="barcodeEnd"
                    name="barcodeEnd"
                    value={barcodeEnd}
                    placeholder="e.g. BC-100 or BC-200"
                    maxLength={40}
                    aria-invalid={barcodeEndError ? true : undefined}
                    onChange={(event) => {
                      setBarcodeEnd(event.target.value);
                      setSuccess("");
                    }}
                    required
                  />
                  <p className="field-help">Ending barcode code limit (e.g. BC-100, expandable to BC-200).</p>
                  {barcodeEndError ? <p className="field-error">{barcodeEndError}</p> : null}
                </div>
              </div>

              {barcodeStats && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background: "var(--paper-subtle, rgba(255, 255, 255, 0.04))",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  fontSize: "0.88rem",
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "center"
                }}>
                  <span>📌 <strong>Current Allocation:</strong> {barcodeStats.allocatedCount ?? 0} books registered</span>
                  {barcodeStats.barcode ? (
                    <span>➡️ <strong>Next Auto Barcode:</strong> <code style={{ color: "var(--brand, #0d9488)", fontWeight: 700 }}>{barcodeStats.barcode}</code></span>
                  ) : (
                    <span style={{ color: "var(--danger, #ef4444)" }}>⚠️ <strong>Limit reached:</strong> Expand Barcode Ends to continue adding books.</span>
                  )}
                </div>
              )}
            </div>

            <div className="actions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" className="button-solid" disabled={saving}>
                  {saving ? "Saving Configuration…" : "Save Master Configuration"}
                </button>
                <button
                  type="button"
                  className="button-go-student-teacher"
                  onClick={() => {
                    setAdminViewMode("student-teacher");
                    router.push("/books");
                  }}
                  title="Go to Student & Teacher portal in view-only admin mode"
                >
                  <span>👁️ Go To Student &amp; Teacher</span>
                </button>
              </div>
              {updatedAt ? (
                <p className="meta" style={{ margin: 0 }}>
                  Last updated {formatDisplayTimestamp(updatedAt)}
                </p>
              ) : null}
            </div>
          </form>

          {/* SIDEBAR: INTERACTIVE LIVE RULES PREVIEW */}
          <aside className="panel preview-panel" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2>Live Rule Preview</h2>
              <p className="panel-copy" style={{ margin: "4px 0 16px" }}>
                Real-time preview of how your settings calculate library operations today.
              </p>
            </div>

            {/* Calculated Dates Card */}
            <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.14)" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.92rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper)" }}>
                📅 Automatic Loan Dates
              </h4>
              <ul className="date-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <li className="date-card">
                  <span>Issue Date (Today)</span>
                  <strong>{formatDisplayDate(issueDate)}</strong>
                  <small>{issueDate}</small>
                </li>
                <li className="date-card">
                  <span>Due Return Date</span>
                  <strong>{returnDate ? formatDisplayDate(returnDate) : "—"}</strong>
                  <small>
                    {returnDate ? `Calculated as today + ${period} days` : "Enter valid borrowing period (1–365)"}
                  </small>
                </li>
              </ul>
            </div>

            {/* Active Quotas Summary */}
            <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.14)" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.92rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper)" }}>
                ⚖️ Reader Quotas
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", display: "flex", flexDirection: "column", gap: 6, color: "rgba(247, 243, 234, 0.9)" }}>
                <li>
                  <strong>Students:</strong> Up to <strong>{studentLimit ?? "—"}</strong> active books at a time.
                </li>
                <li>
                  <strong>Teachers:</strong> Up to <strong>{teacherLimit ?? "—"}</strong> active books at a time.
                </li>
                <li>
                  <strong>Monthly Quota:</strong> Up to <strong>{monthLimit ?? "—"}</strong> books per reader each calendar month.
                </li>
              </ul>
            </div>

            {/* Inventory Capacity */}
            <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.14)" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.92rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper)" }}>
                📦 Inventory Capacity
              </h4>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(247, 243, 234, 0.9)" }}>
                Each catalogue title has <strong>{copiesCount ?? "—"}</strong> standard copies available for borrowing across the university.
              </p>
            </div>

            {/* Barcode Range Summary */}
            <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.14)" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.92rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper)" }}>
                🏷️ Barcode Allocation Range
              </h4>
              <p style={{ margin: "0 0 6px 0", fontSize: "0.88rem", color: "rgba(247, 243, 234, 0.9)" }}>
                Active Range: <strong>{barcodeStart}</strong> → <strong>{barcodeEnd}</strong>
              </p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(247, 243, 234, 0.75)" }}>
                Next auto-barcode: <strong style={{ color: "#fff" }}>{barcodeStats?.barcode ?? (barcodeStats?.error ? "Limit reached" : "—")}</strong>
              </p>
            </div>

            {/* Contact Email */}
            <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.14)" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "0.92rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--paper)" }}>
                ✉️ Support Contact
              </h4>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(247, 243, 234, 0.9)" }}>
                Readers reach out to: <strong>{contactEmail || "—"}</strong>
              </p>
            </div>
          </aside>
        </div>

        {/* ─── MASTER DATA MANAGEMENT SECTION ─── */}
        <div
          style={{
            marginTop: 32,
            padding: "24px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            boxShadow: "var(--shadow)",
          }}
        >
          <h2 style={{ margin: "0 0 4px" }}>📊 Academic Data Management</h2>
          <p className="panel-copy" style={{ marginBottom: 20 }}>
            Manage departments, programs, semesters, batch sessions, and designations. Changes here automatically update all dropdown menus across the entire website (Join Library, Student Forms, Teacher Forms, etc.).
          </p>

          {masterSuccess ? (
            <p className="banner ok" role="status" style={{ marginBottom: 16 }}>
              {masterSuccess}
            </p>
          ) : null}
          {masterError ? (
            <p className="banner error" role="alert" style={{ marginBottom: 16 }}>
              {masterError}
            </p>
          ) : null}

          {/* Tab Navigation */}
          <div role="tablist" style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid var(--line)", paddingBottom: 0, flexWrap: "wrap" }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setShowAddForm(false);
                  setEditingItem(null);
                  setMasterError("");
                  setMasterSuccess("");
                }}
                style={{
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  background: activeTab === tab.key ? "var(--accent, #8b5e34)" : "transparent",
                  color: activeTab === tab.key ? "#fff" : "inherit",
                  border: "none",
                  borderRadius: "8px 8px 0 0",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>

        <div
          style={{
            marginTop: 24,
            padding: "18px 22px",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            boxShadow: "var(--shadow)",
          }}
        >
          <div>
            <strong style={{ display: "block", fontSize: "16px" }}>Student &amp; Teacher Library Portal</strong>
            <p className="panel-copy" style={{ margin: "4px 0 0", fontSize: "13px" }}>
              Experience the library catalogue, books, categories, and circulation rules as Students and Teachers see them (View Only as Administrator).
            </p>
          </div>
          <button
            type="button"
            className="button-go-student-teacher"
            onClick={() => {
              setAdminViewMode("student-teacher");
              router.push("/books");
            }}
            title="Go to Student & Teacher portal in view-only admin mode"
            style={{ padding: "11px 22px", fontSize: "14px" }}
          >
            <span>👁️ Go To Student &amp; Teacher</span>
          </button>
        </div>
        </>
      )}
    </main>
  );
}
