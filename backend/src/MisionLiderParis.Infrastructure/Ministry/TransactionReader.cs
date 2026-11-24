using System.Collections;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Storage;

namespace MisionLiderParis.Infrastructure.Ministry;

internal sealed class TransactionReader(DbDataReader inner, IDbContextTransaction transaction) : DbDataReader
{
    private int disposed;
    private bool failed;
    private void Finish() => FinishAsync().GetAwaiter().GetResult();
    private async Task FinishAsync()
    {
        if (Interlocked.Exchange(ref disposed,1)!=0) return;
        try
        {
            await inner.DisposeAsync().ConfigureAwait(false);
            if (failed) await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
            else await transaction.CommitAsync(CancellationToken.None).ConfigureAwait(false);
        }
        finally { await transaction.DisposeAsync().ConfigureAwait(false); }
    }
    protected override void Dispose(bool disposing) { if (disposing) Finish(); }
    public override async ValueTask DisposeAsync() => await FinishAsync().ConfigureAwait(false);
    public override void Close() => Finish();
    public override bool Read() { try { return inner.Read(); } catch { failed=true; throw; } }
    public override async Task<bool> ReadAsync(CancellationToken ct) { try { return await inner.ReadAsync(ct).ConfigureAwait(false); } catch { failed=true; throw; } }
    public override bool NextResult() { try { return inner.NextResult(); } catch { failed=true; throw; } }
    public override async Task<bool> NextResultAsync(CancellationToken ct) { try { return await inner.NextResultAsync(ct).ConfigureAwait(false); } catch { failed=true; throw; } }
    public override int Depth => inner.Depth;
    public override int FieldCount => inner.FieldCount;
    public override bool HasRows => inner.HasRows;
    public override bool IsClosed => disposed!=0 || inner.IsClosed;
    public override int RecordsAffected => inner.RecordsAffected;
    public override object this[int ordinal] => inner[ordinal];
    public override object this[string name] => inner[name];
    public override bool GetBoolean(int ordinal) => inner.GetBoolean(ordinal);
    public override byte GetByte(int ordinal) => inner.GetByte(ordinal);
    public override long GetBytes(int ordinal,long dataOffset,byte[]? buffer,int bufferOffset,int length) => inner.GetBytes(ordinal,dataOffset,buffer,bufferOffset,length);
    public override char GetChar(int ordinal) => inner.GetChar(ordinal);
    public override long GetChars(int ordinal,long dataOffset,char[]? buffer,int bufferOffset,int length) => inner.GetChars(ordinal,dataOffset,buffer,bufferOffset,length);
    public override string GetDataTypeName(int ordinal) => inner.GetDataTypeName(ordinal);
    public override DateTime GetDateTime(int ordinal) => inner.GetDateTime(ordinal);
    public override decimal GetDecimal(int ordinal) => inner.GetDecimal(ordinal);
    public override double GetDouble(int ordinal) => inner.GetDouble(ordinal);
    public override Type GetFieldType(int ordinal) => inner.GetFieldType(ordinal);
    public override float GetFloat(int ordinal) => inner.GetFloat(ordinal);
    public override Guid GetGuid(int ordinal) => inner.GetGuid(ordinal);
    public override short GetInt16(int ordinal) => inner.GetInt16(ordinal);
    public override int GetInt32(int ordinal) => inner.GetInt32(ordinal);
    public override long GetInt64(int ordinal) => inner.GetInt64(ordinal);
    public override string GetName(int ordinal) => inner.GetName(ordinal);
    public override int GetOrdinal(string name) => inner.GetOrdinal(name);
    public override string GetString(int ordinal) => inner.GetString(ordinal);
    public override object GetValue(int ordinal) => inner.GetValue(ordinal);
    public override int GetValues(object[] values) => inner.GetValues(values);
    public override bool IsDBNull(int ordinal) => inner.IsDBNull(ordinal);
    public override Task<bool> IsDBNullAsync(int ordinal,CancellationToken ct) => inner.IsDBNullAsync(ordinal,ct);
    public override T GetFieldValue<T>(int ordinal) => inner.GetFieldValue<T>(ordinal);
    public override Task<T> GetFieldValueAsync<T>(int ordinal,CancellationToken ct) => inner.GetFieldValueAsync<T>(ordinal,ct);
    public override IEnumerator GetEnumerator() => ((IEnumerable)inner).GetEnumerator();
    public override System.Data.DataTable? GetSchemaTable() => inner.GetSchemaTable();
}
