use snapbox::assert_data_eq;
use snapbox::prelude::*;
use snapbox::str;

use toml::Value::{Array, Boolean, Float, Integer, String, Table};
use toml::map::Map;

/// Datetime values retain their type for typed deserialization and remain JSON strings.
#[test]
fn deserialize_datetime() {
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct Settings {
        last_updated: toml::value::Datetime,
        minimum_interval: i64,
    }

    #[derive(Deserialize)]
    struct Document {
        settings: Settings,
    }

    for datetime in [
        "2023-01-15T11:42:14-06:00",
        "2023-01-15T11:42:14Z",
        "2023-01-15T11:42:14",
        "2023-01-15",
        "11:42:14.123",
    ] {
        let input = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
        let direct: Document = toml::from_str(&input).unwrap();
        let table: toml::Table = toml::from_str(&input).unwrap();
        let value = table.get("settings").unwrap().clone();
        assert_eq!(
            Settings::deserialize(value.clone()).unwrap(),
            direct.settings
        );
        assert_eq!(value.try_into::<Settings>().unwrap(), direct.settings);

        let value = table["settings"]["last_updated"].clone();
        assert_eq!(
            value.clone().try_into::<toml::value::Datetime>().unwrap(),
            direct.settings.last_updated
        );
        assert_eq!(
            serde_json::Value::deserialize(value).unwrap(),
            serde_json::Value::String(datetime.to_owned())
        );
        assert!(
            String(datetime.to_owned())
                .try_into::<toml::value::Datetime>()
                .is_err()
        );
    }
}

#[test]
fn display() {
    assert_data_eq!(
        String("foo".to_owned()).to_string(),
        str![[r#""foo""#]].raw()
    );
    assert_data_eq!(Integer(10).to_string(), str!["10"].raw());
    assert_data_eq!(Float(10.0).to_string(), str!["10.0"].raw());
    assert_data_eq!(Float(2.4).to_string(), str!["2.4"].raw());
    assert_data_eq!(Boolean(true).to_string(), str!["true"].raw());
    assert_data_eq!(Array(vec![]).to_string(), str!["[]"].raw());
    assert_data_eq!(
        Array(vec![Integer(1), Integer(2)]).to_string(),
        str!["[1, 2]"].raw()
    );
    assert_data_eq!(
        Table(map! {"test" => Integer (2), "test2" => Integer(3)}).to_string(),
        str!["{ test = 2, test2 = 3 }"].raw()
    );
}
