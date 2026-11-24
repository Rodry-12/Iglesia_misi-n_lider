using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MisionLiderParis.Domain.Ministry;

namespace MisionLiderParis.Infrastructure.Ministry;

// Mapped only after live inspection. Every ministerial table is excluded from EF migrations.
public sealed class MinistryDbContext : DbContext
{
    public MinistryDbContext(DbContextOptions<MinistryDbContext> options) : base(options)
    {
        Database.AutoTransactionBehavior = Microsoft.EntityFrameworkCore.AutoTransactionBehavior.Always;
    }
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<PersonDocument> Documents => Set<PersonDocument>();
    public DbSet<DocumentType> DocumentTypes => Set<DocumentType>();
    public DbSet<PersonBranch> Memberships => Set<PersonBranch>();
    public DbSet<ProcessCategory> Categories => Set<ProcessCategory>();
    public DbSet<MinistryProcess> Processes => Set<MinistryProcess>();
    public DbSet<ProcessState> States => Set<ProcessState>();
    public DbSet<ProcessAssignment> Assignments => Set<ProcessAssignment>();
    public DbSet<FunctionalRole> Roles => Set<FunctionalRole>();
    public DbSet<FunctionalPermission> Permissions => Set<FunctionalPermission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    // Maps PostgreSQL's existing built-in; it does not create a database function.
    [DbFunction("translate", IsBuiltIn = true)]
    public static string TranslateSearch(string value, string characters, string replacements) =>
        throw new InvalidOperationException("Search translation must execute in PostgreSQL.");

    protected override void OnModelCreating(ModelBuilder model)
    {
        var documentType = model.Entity<DocumentType>();
        documentType.ToTable("tipo_documento", "iglesia", table => table.ExcludeFromMigrations());
        documentType.HasKey(x => x.Code);
        documentType.Property(x => x.Code).HasColumnName("codigo").HasMaxLength(2);
        documentType.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(100);

        var branch = Map<Branch>(model, "sede");
        branch.Property(x => x.UpdatedAt).IsConcurrencyToken();
        branch.Property(x => x.Code).HasColumnName("codigo").HasMaxLength(20);
        branch.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(150);
        branch.Property(x => x.Address).HasColumnName("direccion").HasMaxLength(250);
        branch.Property(x => x.Phone).HasColumnName("telefono").HasMaxLength(30);
        branch.Property(x => x.IsActive).HasColumnName("activa").HasDefaultValue(true);
        branch.HasIndex(x => x.Code).IsUnique().HasDatabaseName("uq_sede_codigo");
        Check(branch, "ck_sede_codigo", "length(trim(codigo)) > 0");
        Check(branch, "ck_sede_nombre", "length(trim(nombre)) > 0");

        var person = Map<Person>(model, "persona");
        person.Property(x => x.UpdatedAt).IsConcurrencyToken();
        person.Property(x => x.FirstNames).HasColumnName("nombres").HasMaxLength(150);
        person.Property(x => x.LastNames).HasColumnName("apellidos").HasMaxLength(150);
        person.Property(x => x.Phone).HasColumnName("telefono").HasMaxLength(30);
        person.Property(x => x.Email).HasColumnName("correo").HasMaxLength(255);
        person.Property(x => x.BirthDate).HasColumnName("fecha_nacimiento").HasColumnType("date");
        person.Property(x => x.IsActive).HasColumnName("activa").HasDefaultValue(true);
        Check(person, "ck_persona_nombres", "length(trim(nombres)) > 0");
        Check(person, "ck_persona_apellidos", "length(trim(apellidos)) > 0");

        var document = Map<PersonDocument>(model, "persona_documento");
        document.Property(x => x.PersonId).HasColumnName("persona_id");
        document.Property(x => x.DocumentType).HasColumnName("tipo_documento").HasMaxLength(30);
        document.Property(x => x.DocumentNumber).HasColumnName("numero_documento").HasMaxLength(50);
        document.Property(x => x.IssuingCountry).HasColumnName("pais_emisor").HasColumnType("character(2)").HasDefaultValue("CO");
        document.Property(x => x.IsCurrent).HasColumnName("vigente").HasDefaultValue(true);
        document.Property(x => x.EndedAt).HasColumnName("fecha_finalizacion");
        document.HasOne(x => x.Person).WithMany(x => x.Documents).HasForeignKey(x => x.PersonId).OnDelete(DeleteBehavior.Restrict);
        document.HasIndex(x => new { x.IssuingCountry, x.DocumentType, x.DocumentNumber }).IsUnique().HasDatabaseName("uq_persona_documento");
        document.HasIndex(x => x.PersonId).IsUnique().HasFilter("vigente = true").HasDatabaseName("ux_persona_documento_vigente");
        document.HasIndex(x => x.PersonId, "PersonDocumentPersonIndex").HasDatabaseName("ix_persona_documento_persona");
        Check(document, "ck_documento_numero", "length(trim(numero_documento)) > 0");
        Check(document, "ck_documento_tipo", "length(trim(tipo_documento)) > 0");
        Check(document, "ck_documento_vigencia", "(vigente = true AND fecha_finalizacion IS NULL) OR (vigente = false AND fecha_finalizacion IS NOT NULL)");

        var membership = Map<PersonBranch>(model, "persona_sede");
        membership.Property(x => x.PersonId).HasColumnName("persona_id");
        membership.Property(x => x.BranchId).HasColumnName("sede_id");
        membership.Property(x => x.StartedAt).HasColumnName("fecha_inicio").HasDefaultValueSql("now()");
        membership.Property(x => x.EndedAt).HasColumnName("fecha_fin");
        membership.Property(x => x.DepartureReason).HasColumnName("motivo_salida");
        membership.HasOne(x => x.Person).WithMany(x => x.Memberships).HasForeignKey(x => x.PersonId).OnDelete(DeleteBehavior.Restrict);
        membership.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        membership.HasIndex(x => x.PersonId).IsUnique().HasFilter("fecha_fin IS NULL").HasDatabaseName("ux_persona_sede_activa");
        membership.HasIndex(x => x.BranchId).HasDatabaseName("ix_persona_sede_sede");
        Check(membership, "ck_persona_sede_fechas", "fecha_fin IS NULL OR fecha_fin >= fecha_inicio");

        var category = Map<ProcessCategory>(model, "categoria_proceso");
        category.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(150);
        category.Property(x => x.Description).HasColumnName("descripcion");
        category.Property(x => x.SortOrder).HasColumnName("orden").HasDefaultValue(0);
        category.Property(x => x.IsActive).HasColumnName("activa").HasDefaultValue(true);
        category.HasIndex(x => x.Name).IsUnique().HasDatabaseName("uq_categoria_proceso_nombre");
        Check(category, "ck_categoria_proceso_nombre", "length(trim(nombre)) > 0");
        Check(category, "ck_categoria_proceso_orden", "orden >= 0");

        var process = Map<MinistryProcess>(model, "proceso");
        process.Property(x => x.CategoryId).HasColumnName("categoria_id");
        process.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(150);
        process.Property(x => x.Description).HasColumnName("descripcion");
        process.Property(x => x.SortOrder).HasColumnName("orden").HasDefaultValue(0);
        process.Property(x => x.IsActive).HasColumnName("activo").HasDefaultValue(true);
        process.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        process.HasIndex(x => new { x.CategoryId, x.Name }).IsUnique().HasDatabaseName("uq_proceso_categoria_nombre");
        process.HasIndex(x => x.CategoryId).HasDatabaseName("ix_proceso_categoria");
        Check(process, "ck_proceso_nombre", "length(trim(nombre)) > 0");
        Check(process, "ck_proceso_orden", "orden >= 0");

        var state = Map<ProcessState>(model, "estado_proceso");
        state.Property(x => x.Code).HasColumnName("codigo").HasMaxLength(30);
        state.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(100);
        state.Property(x => x.IsFinal).HasColumnName("es_final").HasDefaultValue(false);
        state.HasIndex(x => x.Code).IsUnique().HasDatabaseName("estado_proceso_codigo_key");
        Check(state, "ck_estado_proceso_codigo", "length(trim(codigo)) > 0");
        Check(state, "ck_estado_proceso_nombre", "length(trim(nombre)) > 0");

        var assignment = Map<ProcessAssignment>(model, "persona_proceso");
        assignment.Property(x => x.PersonId).HasColumnName("persona_id");
        assignment.Property(x => x.ProcessId).HasColumnName("proceso_id");
        assignment.Property(x => x.ResponsiblePersonId).HasColumnName("responsable_persona_id");
        assignment.Property(x => x.BranchId).HasColumnName("sede_id");
        assignment.Property(x => x.StateId).HasColumnName("estado_id");
        assignment.Property(x => x.AssignedAt).HasColumnName("fecha_asignacion").HasDefaultValueSql("now()");
        assignment.Property(x => x.StartedAt).HasColumnName("fecha_inicio");
        assignment.Property(x => x.FinishedAt).HasColumnName("fecha_finalizacion");
        assignment.HasOne(x => x.Person).WithMany().HasForeignKey(x => x.PersonId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.ResponsiblePerson).WithMany().HasForeignKey(x => x.ResponsiblePersonId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.Process).WithMany().HasForeignKey(x => x.ProcessId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasIndex(x => x.PersonId).HasDatabaseName("ix_persona_proceso_persona");
        assignment.HasIndex(x => x.ResponsiblePersonId).HasDatabaseName("ix_persona_proceso_responsable");
        assignment.HasIndex(x => x.BranchId).HasDatabaseName("ix_persona_proceso_sede");
        assignment.HasIndex(x => x.ProcessId).HasDatabaseName("ix_persona_proceso_proceso");
        assignment.HasIndex(x => x.StateId).HasDatabaseName("ix_persona_proceso_estado");
        assignment.HasIndex(x => new { x.PersonId, x.ProcessId }).IsUnique()
            .HasFilter("fecha_finalizacion IS NULL").HasDatabaseName("ux_persona_proceso_abierto_fecha");
        assignment.ToTable("persona_proceso", "iglesia", table =>
        {
            table.HasTrigger("trg_validar_asignacion_proceso");
            table.HasTrigger("trg_validar_proceso_duplicado");
            table.HasTrigger("trg_validar_estado_fechas");
            table.ExcludeFromMigrations();
        });
        Check(assignment, "ck_persona_proceso_responsable", "persona_id <> responsable_persona_id");
        Check(assignment, "ck_persona_proceso_fechas_v2", "(fecha_inicio IS NULL OR fecha_inicio >= fecha_asignacion) AND (fecha_finalizacion IS NULL OR fecha_finalizacion >= fecha_asignacion) AND (fecha_finalizacion IS NULL OR fecha_inicio IS NULL OR fecha_finalizacion >= fecha_inicio)");

        var role = Map<FunctionalRole>(model, "rol");
        role.Property(x => x.Code).HasColumnName("codigo").HasMaxLength(40);
        role.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(100);
        role.Property(x => x.Description).HasColumnName("descripcion").HasMaxLength(300);
        role.Property(x => x.IsGlobal).HasColumnName("es_global").HasDefaultValue(false);
        role.Property(x => x.IsActive).HasColumnName("activo").HasDefaultValue(true);
        role.HasIndex(x => x.Code).IsUnique().HasDatabaseName("uq_rol_codigo");
        Check(role, "ck_rol_codigo", "length(trim(codigo)) > 0");
        Check(role, "ck_rol_nombre", "length(trim(nombre)) > 0");

        var permission = Map<FunctionalPermission>(model, "permiso");
        permission.Property(x => x.Code).HasColumnName("codigo").HasMaxLength(100);
        permission.Property(x => x.Name).HasColumnName("nombre").HasMaxLength(150);
        permission.Property(x => x.Description).HasColumnName("descripcion").HasMaxLength(300);
        permission.Property(x => x.Module).HasColumnName("modulo").HasMaxLength(50);
        permission.Property(x => x.IsActive).HasColumnName("activo").HasDefaultValue(true);
        permission.HasIndex(x => x.Code).IsUnique().HasDatabaseName("uq_permiso_codigo");
        Check(permission, "ck_permiso_codigo", "length(trim(codigo)) > 0");
        Check(permission, "ck_permiso_nombre", "length(trim(nombre)) > 0");
        Check(permission, "ck_permiso_modulo", "length(trim(modulo)) > 0");

        var link = model.Entity<RolePermission>();
        link.ToTable("rol_permiso", "iglesia", table => table.ExcludeFromMigrations());
        link.HasKey(x => new { x.RoleId, x.PermissionId }).HasName("pk_rol_permiso");
        link.Property(x => x.RoleId).HasColumnName("rol_id");
        link.Property(x => x.PermissionId).HasColumnName("permiso_id");
        link.Property(x => x.CreatedAt).HasColumnName("fecha_creacion").HasDefaultValueSql("now()");
        link.HasOne(x => x.Role).WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_rol_permiso_rol");
        link.HasOne(x => x.Permission).WithMany().HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Cascade).HasConstraintName("fk_rol_permiso_permiso");
        link.HasIndex(x => x.PermissionId).HasDatabaseName("ix_rol_permiso_permiso");
    }

    private static EntityTypeBuilder<T> Map<T>(ModelBuilder model, string name) where T : Entity
    {
        var entity = model.Entity<T>();
        entity.ToTable(name, "iglesia", table => table.ExcludeFromMigrations());
        entity.HasKey(x => x.Id).HasName(name + "_pkey");
        entity.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        if (typeof(CreatedEntity).IsAssignableFrom(typeof(T)))
            entity.Property(nameof(CreatedEntity.CreatedAt)).HasColumnName("fecha_creacion").HasDefaultValueSql("now()");
        if (typeof(TrackedEntity).IsAssignableFrom(typeof(T)))
            entity.Property(nameof(TrackedEntity.UpdatedAt)).HasColumnName("fecha_actualizacion").HasDefaultValueSql("now()");
        return entity;
    }

    private static void Check<T>(EntityTypeBuilder<T> entity, string name, string expression) where T : class =>
        entity.ToTable(table => table.HasCheckConstraint(name, expression));
}
