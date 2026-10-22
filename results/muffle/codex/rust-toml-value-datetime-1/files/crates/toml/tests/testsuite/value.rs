use snapbox::assert_data_eq;
use snapbox::prelude::*;
use snapbox::str;

use toml::Value::{Array, Boolean, Float, Integer, String, Table};
use toml::map::Map;

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
        "2023-01-15T11:42:14.123",
        "2023-01-15",
        "11:42:14.123",
    ] {
        let input = format!("[settings]\nlast_updated = {datetime}\nminimum_interval = 3600\n");
        let direct: Document = toml::from_str(&input).unwrap();
        let table: toml::Table = toml::from_str(&input).unwrap();
        let value = table.get("settings").unwrap().clone();
        let settings = Settings::deserialize(value.clone()).unwrap();
        assert_eq!(settings, direct.settings);
        assert_eq!(value.clone().try_into::<Settings>().unwrap(), settings);
        assert_eq!(
            Settings::deserialize(value.as_table().unwrap().clone()).unwrap(),
            settings
        );

        let value = value.get("last_updated").unwrap().clone();
        assert_eq!(
            value.clone().try_into::<toml::value::Datetime>().unwrap(),
            settings.last_updated
        );
        assert_eq!(
            serde_json::Value::deserialize(value.clone()).unwrap(),
            serde_json::Value::String(datetime.to_owned())
        );
        assert_eq!(value.try_into::<std::string::String>().unwrap(), datetime);
    }

    assert!(
        String("2023-01-15T11:42:14-06:00".to_owned())
            .try_into::<toml::value::Datetime>()
            .is_err()
    );
}
