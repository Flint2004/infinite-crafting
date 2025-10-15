# 数据持久化目录

此目录用于存储 OpenCraft 的 SQLite 数据库文件。

## 文件说明

- `cache.db` - 主数据库文件，包含：
  - 用户表 (users)
  - 元素表 (elements)
  - 合成缓存表 (craft_cache)

## Docker 挂载

在 `docker-compose.yml` 中，此目录通过 volume 挂载到容器：

```yaml
volumes:
  - ./server/data:/app/data
```

这确保了即使容器重启或删除，数据也不会丢失。

## 备份建议

定期备份数据库文件：

```bash
# 手动备份
cp cache.db cache.db.backup.$(date +%Y%m%d)

# 自动备份 (添加到 crontab)
0 0 * * * cp /path/to/server/data/cache.db /path/to/backup/cache.db.$(date +\%Y\%m\%d)
```

## 注意事项

- 不要手动修改数据库文件
- 确保目录具有适当的读写权限
- 此目录已添加到 `.gitignore`，不会被提交到版本控制

