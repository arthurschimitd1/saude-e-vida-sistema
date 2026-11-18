import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AttendanceRecord = sequelize.define('AttendanceRecord', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    empresa_id: { type: DataTypes.INTEGER, allowNull: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: true, field: 'employee_id' },
    employeeName: { type: DataTypes.STRING(255), allowNull: false, field: 'employee_name' },
    employeeCargo: { type: DataTypes.STRING(100), allowNull: true, field: 'employee_cargo' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    checkIn: { type: DataTypes.STRING(8), allowNull: true, field: 'check_in' },
    lunchOut: { type: DataTypes.STRING(8), allowNull: true, field: 'lunch_out' },
    lunchReturn: { type: DataTypes.STRING(8), allowNull: true, field: 'lunch_return' },
    checkOut: { type: DataTypes.STRING(8), allowNull: true, field: 'check_out' },
    totalHours: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'total_hours' },
    extraHours: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'extra_hours' },
    lateMinutes: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0, field: 'late_minutes' },
    status: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'AUSENTE' },
    observation: { type: DataTypes.TEXT, allowNull: true },
    imported: { type: DataTypes.BOOLEAN, defaultValue: false },
    importedFile: { type: DataTypes.STRING(255), allowNull: true, field: 'imported_file' },
    importedAt: { type: DataTypes.DATE, allowNull: true, field: 'imported_at' },
    auditLog: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'audit_log' },
    pauses: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    totalPauseMinutes: { type: DataTypes.DECIMAL(8, 2), allowNull: true, defaultValue: 0, field: 'total_pause_minutes' },
    extraInicio: { type: DataTypes.STRING(8), allowNull: true, field: 'extra_inicio' },
}, {
    tableName: 'attendance_records',
    timestamps: true,
});

export default AttendanceRecord;
